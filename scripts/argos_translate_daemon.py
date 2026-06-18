#!/usr/bin/env python3
"""Argos Translate daemon with dictionary lookup.

Reads JSON lines from stdin, writes JSON lines to stdout.
Loads the Argos Translate model and ECDICT dictionary once at startup.
"""

import json
import logging
import sys

logger = logging.getLogger(__name__)


def load_argos():
    """Import and initialise argostranslate. Runs once at startup."""
    import contextlib

    logging.basicConfig(stream=sys.stderr, level=logging.ERROR, force=True)
    logging.disable(logging.WARNING)
    with contextlib.redirect_stdout(sys.stderr):
        from argostranslate import translate
        return translate
    return None  # unreachable


def load_dictionary():
    """Load the compact ECDICT JSON next to this script.

    The dictionary is a compact ECDICT map. Newer entries use:
    {p: phonetic, t: Chinese translations[], d: English definitions[],
    pos: part-of-speech tags[], e: exchange map}.
    Older generated entries used {p, d}; those are still accepted.
    Most keys are lowercase; we also add lowercase-keyed entries for
    words that start with a capital to support case-insensitive lookups.
    """
    import os
    import gzip

    script_dir = os.path.dirname(os.path.abspath(__file__))
    gz_path = os.path.join(script_dir, "ecdict_compact.json.gz")
    json_path = os.path.join(script_dir, "ecdict_compact.json")

    if os.path.exists(gz_path):
        with gzip.open(gz_path, "rt", encoding="utf-8") as fh:
            raw = json.load(fh)
    elif os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
    else:
        return {}

    # Add lowercase aliases for case-insensitive lookup
    expanded = dict(raw)
    for key in list(raw.keys()):
        lower = key.lower()
        if lower not in expanded:
            expanded[lower] = raw[key]

    return expanded


def lookup_word(dictionary, word, translate_mod=None, source="en", target="zh"):
    """Look up a word in the dictionary with case-insensitive fallback."""
    text = word.strip()
    if not text:
        return None

    # Try exact match first, then lowercase
    entry = dictionary.get(text) or dictionary.get(text.lower())
    if not entry:
        return None

    return {
        "word": text,
        "phonetic": entry.get("p", ""),
        "definitions": entry_to_definitions(entry, translate_mod, source, target),
        "exchange": entry.get("e", {}),
    }


def entry_to_definitions(entry, translate_mod, source, target):
    translations = normalize_lines(entry.get("t", []))
    definitions = normalize_lines(entry.get("d", []))
    pos_tags = normalize_lines(entry.get("pos", []))

    if translations:
        items = []
        for index, translation in enumerate(translations):
            pos, meaning = split_prefixed_definition(translation)
            english_pos = ""
            english = ""
            if index < len(definitions):
                english_pos, english = split_prefixed_definition(definitions[index])
            if not pos and index < len(pos_tags):
                pos = pos_tags[index]
            if not pos:
                pos = english_pos
            items.append({"pos": pos, "meaning": english, "translation": meaning})
        return items

    return enrich_definitions(
        parse_definitions(entry.get("d", "")),
        translate_mod,
        source,
        target,
    )


def normalize_lines(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [line.strip() for line in value.split("\\n") if line.strip()]
    return []


def parse_definitions(raw):
    """Parse ECDICT definition text into structured entries.

    The raw format uses \\n as a separator and prefixes like 'n.', 'v.', 'a.', etc.
    for parts of speech. We split and group by POS.
    """
    if not raw:
        return []

    parts = raw.split("\\n")
    definitions = []

    for part in parts:
        part = part.strip()
        if not part:
            continue

        pos, meaning = split_prefixed_definition(part)
        definitions.append({"pos": pos, "meaning": meaning})

    return definitions


def split_prefixed_definition(part):
    # Common POS patterns: n., v., a., adj., adv., prep., conj., int., def.
    for prefix in (
        "definite article",
        "indefinite article",
        "def. article",
        "def art.",
        "adj.",
        "adv.",
        "conj.",
        "int.",
        "interj.",
        "n.",
        "prep.",
        "pron.",
        "vt.& vi.",
        "vt.",
        "vi.",
        "v.",
        "a.",
        "s.",
        "abbr.",
        "aux.",
        "det.",
        "pref.",
        "suf.",
        "suff.",
    ):
        if part.startswith(prefix):
            return prefix, part[len(prefix) :].strip()
    return "", part


def enrich_definitions(definitions, translate_mod, source, target):
    """Add a Chinese translation field when the dictionary meaning is English."""
    if not translate_mod or target not in ("zh", "zt"):
        return definitions

    enriched = []
    translator = None

    for item in definitions[:6]:
        next_item = dict(item)
        meaning = next_item.get("meaning", "").strip()
        if meaning and not contains_cjk(meaning):
            try:
                if translator is None:
                    installed_languages = translate_mod.get_installed_languages()
                    from_language = next(
                        (lang for lang in installed_languages if lang.code == source), None
                    )
                    to_language = next(
                        (lang for lang in installed_languages if lang.code == target), None
                    )
                    if from_language is None or to_language is None:
                        translator = False
                    else:
                        translator = from_language.get_translation(to_language)
                if translator:
                    next_item["translation"] = translator.translate(meaning)
            except Exception:
                pass
        enriched.append(next_item)

    if len(definitions) > len(enriched):
        enriched.extend(definitions[len(enriched) :])
    return enriched


def contains_cjk(value):
    return any("\u3400" <= char <= "\u9fff" for char in value)


def handle_request(translate_mod, dictionary, payload):
    """Process a single translation or dictionary request."""
    text = str(payload.get("text", "")).strip()
    source = str(payload.get("source", "en") or "en")
    target = str(payload.get("target", "zh") or "zh")
    mode = str(payload.get("mode", "translate") or "translate")

    if not text:
        return {"error": "No text provided."}

    if mode == "dict" and dictionary:
        result = lookup_word(dictionary, text, translate_mod, source, target)
        if result:
            return {"wordDetails": result, "translatedText": format_word_details(result)}

    # Fall through to translation
    installed_languages = translate_mod.get_installed_languages()
    from_language = next(
        (lang for lang in installed_languages if lang.code == source), None
    )
    to_language = next(
        (lang for lang in installed_languages if lang.code == target), None
    )

    if from_language is None or to_language is None:
        return {
            "error": f"Argos language package is not installed for {source}->{target}."
        }

    translation = from_language.get_translation(to_language)
    translated_text = translation.translate(text)
    return {"translatedText": translated_text}


def format_word_details(result):
    """Format dictionary result as human-readable text."""
    lines = []
    if result.get("phonetic"):
        lines.append(f"Phonetic: {result['phonetic']}")
    lines.append("")
    for d in result.get("definitions", []):
        if d.get("translation"):
            if d["pos"]:
                lines.append(f"{d['pos']} {d['translation']}")
            else:
                lines.append(d["translation"])
            continue
        if d["pos"]:
            lines.append(f"{d['pos']} {d['meaning']}")
        else:
            lines.append(d["meaning"])
    return "\n".join(lines)


def main():
    print("Loading Argos Translate model...", file=sys.stderr, flush=True)
    translate_mod = load_argos()
    dictionary = load_dictionary()
    print(
        f"Daemon ready. Dictionary: {len(dictionary)} entries.",
        file=sys.stderr,
        flush=True,
    )

    # Signal readiness
    print(json.dumps({"ready": True}, ensure_ascii=False), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
            result = handle_request(translate_mod, dictionary, payload)
        except Exception as exc:
            result = {"error": str(exc)}

        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
