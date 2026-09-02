#!/usr/bin/env python3
"""Validate catalog + lesson JSON for udl-vocab-play."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HAN_RE = re.compile(r"[\u3400-\u9FFF]")


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def load(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"{path}: {exc}")


def han_len(word: str) -> int:
    return len(HAN_RE.findall(word))


def check_item(kind: str, item: dict, seen: set[str]) -> None:
    for field in ("key", "word", "zhuyin", "mean"):
        if not str(item.get(field) or "").strip():
            fail(f"{kind} missing {field}: {item}")
    key = item["key"]
    if key in seen:
        fail(f"duplicate key {key}")
    seen.add(key)
    syllables = [part for part in str(item["zhuyin"]).split() if part]
    expected = han_len(item["word"])
    if kind == "phrase" and len(syllables) != expected:
        fail(f"{item['word']}: zhuyin has {len(syllables)} syllables, word has {expected} han")
    if kind == "char" and expected != 1:
        fail(f"vocab {item['word']} should be one character")
    if kind == "char" and len(syllables) != 1:
        fail(f"vocab {item['word']} zhuyin should be one syllable")


def check_lesson(path: Path) -> None:
    data = load(path)
    if not isinstance(data, dict):
        fail(f"{path} is not an object")
    for field in ("id", "title", "vocab", "phrases"):
        if field not in data:
            fail(f"{path} missing {field}")
    seen: set[str] = set()
    vocab = data["vocab"]
    phrases = data["phrases"]
    if not vocab:
        fail(f"{path} vocab is empty")
    if not phrases:
        fail(f"{path} phrases is empty")
    for item in vocab:
        check_item("char", item, seen)
    for item in phrases:
        check_item("phrase", item, seen)


def main() -> None:
    catalog_path = ROOT / "data" / "catalog.json"
    catalog = load(catalog_path)
    ready = 0
    for book in catalog.get("books") or []:
        for lesson in book.get("lessons") or []:
            if not lesson.get("ready"):
                continue
            file = lesson.get("file")
            if not file:
                fail(f"{lesson.get('id')} is ready but has no file")
            path = ROOT / file
            if not path.is_file():
                fail(f"missing {path}")
            check_lesson(path)
            payload = load(path)
            if payload.get("id") != lesson.get("id"):
                fail(f"{path} id mismatch")
            ready += 1
    if ready < 1:
        fail("no ready lessons")
    print(f"OK: {ready} ready lesson(s)")


if __name__ == "__main__":
    main()
