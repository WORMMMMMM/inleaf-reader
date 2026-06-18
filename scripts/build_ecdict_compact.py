#!/usr/bin/env python3
"""Build the compact ECDICT dictionary used by the reader.

The source CSV comes from https://github.com/skywind3000/ECDICT (MIT).
By default this script downloads the upstream CSV and writes a gzipped JSON
dictionary next to the translation daemon.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import sys
import urllib.request
from pathlib import Path


DEFAULT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
DEFAULT_OUTPUT = Path(__file__).with_name("ecdict_compact.json.gz")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=DEFAULT_URL,
        help="ECDICT CSV path or URL. Defaults to the upstream GitHub raw CSV.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Output .json.gz path.",
    )
    parser.add_argument(
        "--plain-json",
        default="",
        help="Optional plain JSON output path for inspection. Do not commit it.",
    )
    args = parser.parse_args()

    rows = read_csv_rows(args.source)
    compact = build_compact_dictionary(rows)
    write_gzip_json(Path(args.output), compact)
    if args.plain_json:
      write_plain_json(Path(args.plain_json), compact)

    print(f"Wrote {len(compact)} entries to {args.output}")
    return 0


def read_csv_rows(source: str):
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=120) as response:
            text = response.read().decode("utf-8-sig")
        return csv.DictReader(text.splitlines())

    fh = open(source, "r", encoding="utf-8-sig", newline="")
    return csv.DictReader(fh)


def build_compact_dictionary(rows) -> dict[str, dict[str, object]]:
    compact: dict[str, dict[str, object]] = {}

    for row in rows:
        word = clean(row.get("word", ""))
        if not word:
            continue

        entry: dict[str, object] = {}
        put(entry, "p", clean(row.get("phonetic", "")))
        put(entry, "t", split_lines(row.get("translation", "")))
        put(entry, "d", split_lines(row.get("definition", "")))
        put(entry, "pos", split_pos(row.get("pos", "")))
        put(entry, "e", parse_exchange(row.get("exchange", "")))

        collins = to_int(row.get("collins", ""))
        oxford = to_int(row.get("oxford", ""))
        bnc = to_int(row.get("bnc", ""))
        frq = to_int(row.get("frq", ""))
        tag = clean(row.get("tag", ""))

        if collins:
            entry["collins"] = collins
        if oxford:
            entry["oxford"] = oxford
        if bnc:
            entry["bnc"] = bnc
        if frq:
            entry["frq"] = frq
        if tag:
            entry["tag"] = tag

        if entry:
            compact[word] = entry

    return compact


def clean(value: str | None) -> str:
    return (value or "").strip()


def put(entry: dict[str, object], key: str, value: object):
    if value:
        entry[key] = value


def split_lines(value: str | None) -> list[str]:
    normalized = (value or "").replace("\\n", "\n")
    return [line.strip() for line in normalized.splitlines() if line.strip()]


def split_pos(value: str | None) -> list[str]:
    raw = clean(value)
    if not raw:
        return []
    parts = raw.replace("；", ";").replace(",", ";").split(";")
    return [part.strip() for part in parts if part.strip()]


def parse_exchange(value: str | None) -> dict[str, list[str]]:
    raw = clean(value)
    if not raw:
        return {}

    exchange: dict[str, list[str]] = {}
    for part in raw.split("/"):
        if not part or ":" not in part:
            continue
        kind, forms = part.split(":", 1)
        values = [item for item in forms.split(",") if item]
        if kind and values:
            exchange[kind] = values
    return exchange


def to_int(value: str | None) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def write_gzip_json(path: Path, payload: object):
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wt", encoding="utf-8", compresslevel=9) as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def write_plain_json(path: Path, payload: object):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
