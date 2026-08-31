#!/usr/bin/env python3
"""Build the sharded ECDICT dictionary used by the reader.

The source CSV comes from https://github.com/skywind3000/ECDICT (MIT).
By default this script downloads the upstream CSV and writes 64 compressed
JSON shards. The reader loads only the shard needed for a lookup.
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
DEFAULT_OUTPUT = Path(__file__).with_name("ecdict")
DEFAULT_BUCKET_COUNT = 64


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
        help="Output directory for the compressed shards.",
    )
    parser.add_argument("--bucket-count", type=int, default=DEFAULT_BUCKET_COUNT)
    args = parser.parse_args()

    compact = read_compact_source(args.source)
    output = Path(args.output)
    write_shards(output, compact, args.bucket_count)

    print(f"Wrote {len(compact)} entries across {args.bucket_count} shards to {args.output}")
    return 0


def read_compact_source(source: str) -> dict[str, dict[str, object]]:
    source_path = Path(source)
    if source_path.suffixes[-2:] == [".json", ".gz"]:
        with gzip.open(source_path, "rt", encoding="utf-8") as fh:
            payload = json.load(fh)
        if not isinstance(payload, dict):
            raise ValueError("Compact ECDICT source must be a JSON object")
        return payload

    return build_compact_dictionary(read_csv_rows(source))


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


def write_shards(
    output: Path,
    compact: dict[str, dict[str, object]],
    bucket_count: int,
):
    if bucket_count < 1 or bucket_count > 256:
        raise ValueError("bucket-count must be between 1 and 256")
    output.mkdir(parents=True, exist_ok=True)
    for previous_shard in output.glob("*.json.gz"):
        previous_shard.unlink()
    buckets: list[dict[str, dict[str, object]]] = [dict() for _ in range(bucket_count)]
    for word, entry in compact.items():
        buckets[fnv1a(word.lower()) % bucket_count][word] = entry

    for index, bucket in enumerate(buckets):
        shard_path = output / f"{index:02x}.json.gz"
        with gzip.open(shard_path, "wt", encoding="utf-8", compresslevel=9) as fh:
            json.dump(bucket, fh, ensure_ascii=False, separators=(",", ":"))

    manifest = {
        "format": "inleaf-ecdict-shards",
        "version": 1,
        "bucketCount": bucket_count,
        "entryCount": len(compact),
        "source": "https://github.com/skywind3000/ECDICT",
        "license": "MIT",
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def fnv1a(value: str) -> int:
    result = 0x811C9DC5
    for byte in value.encode("utf-8"):
        result ^= byte
        result = (result * 0x01000193) & 0xFFFFFFFF
    return result


if __name__ == "__main__":
    raise SystemExit(main())
