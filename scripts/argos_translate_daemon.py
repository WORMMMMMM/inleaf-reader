#!/usr/bin/env python3
"""Long-lived Argos sentence-translation daemon.

Reads JSON lines from stdin and writes request-id-matched JSON lines to stdout.
Offline ECDICT lookup is handled by a Node worker in the extension host.
"""

import contextlib
import json
import logging
import sys


def load_argos():
    """Import and initialise argostranslate once at startup."""
    logging.basicConfig(stream=sys.stderr, level=logging.ERROR, force=True)
    logging.disable(logging.WARNING)
    with contextlib.redirect_stdout(sys.stderr):
        from argostranslate import translate

        return translate


def handle_request(translate_mod, payload):
    """Process one sentence-translation request."""
    request_id = payload.get("requestId")
    text = str(payload.get("text", "")).strip()
    source = str(payload.get("source", "en") or "en")
    target = str(payload.get("target", "zh") or "zh")

    if not text:
        return {"requestId": request_id, "error": "No text provided."}

    installed_languages = translate_mod.get_installed_languages()
    from_language = next(
        (language for language in installed_languages if language.code == source), None
    )
    to_language = next(
        (language for language in installed_languages if language.code == target), None
    )
    if from_language is None or to_language is None:
        return {
            "requestId": request_id,
            "error": f"Argos language package is not installed for {source}->{target}.",
        }

    translation = from_language.get_translation(to_language)
    return {
        "requestId": request_id,
        "translatedText": translation.translate(text),
    }


def main():
    print("Loading Argos Translate model...", file=sys.stderr, flush=True)
    translate_mod = load_argos()
    print("Daemon ready.", file=sys.stderr, flush=True)
    print(json.dumps({"ready": True}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        payload = {}
        try:
            payload = json.loads(line)
            result = handle_request(translate_mod, payload)
        except Exception as exc:
            request_id = payload.get("requestId") if isinstance(payload, dict) else None
            result = {"requestId": request_id, "error": str(exc)}
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
