#!/usr/bin/env python3
"""Turn data/raw/*.txt into src/data/corpus.json and scripts/audio-manifest.json."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data" / "corpus.json"
MANIFEST = ROOT / "scripts" / "audio-manifest.json"

CHAPTERS = {
    "3": {
        "id": "3",
        "index": "第三章",
        "title": "特别名词",
        "subtitle": "地点、人物、学术和生活里要写对的名词",
    },
    "4": {
        "id": "4",
        "index": "第四章",
        "title": "形容词与副词",
        "subtitle": "修饰和程度，注意词尾和拼写",
    },
    "5": {
        "id": "5",
        "index": "第五章",
        "title": "短语与连读",
        "subtitle": "听力里成组出现的搭配，按原词序写下",
    },
    "11": {
        "id": "11",
        "index": "第十一章",
        "title": "综合测试",
        "subtitle": "按听力四个 Section 的场景来练",
    },
}


def sort_key(section_id: str) -> tuple[int, ...]:
    return tuple(int(part) for part in re.split(r"[.\-]", section_id))


def audio_file(text: str) -> str:
    key = re.sub(r"\s+", " ", text.strip().lower())
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
    return f"{digest}.mp3"


def parse() -> list[dict]:
    sections: list[dict] = []
    current: dict | None = None
    for path in sorted(RAW.glob("*.txt")):
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            if line.startswith("## "):
                section_id, title, hint = (line[3:].split("\t") + ["", ""])[:3]
                current = {
                    "id": section_id.strip(),
                    "title": title.strip(),
                    "hint": hint.strip(),
                    "words": [],
                }
                sections.append(current)
                continue
            if current is None:
                raise SystemExit(f"{path}:{line_no} entry before a section header")
            cols = line.split("\t")
            word = cols[0].strip()
            meaning = cols[1].strip() if len(cols) > 1 else ""
            alts = [part.strip() for part in cols[2].split(";")] if len(cols) > 2 and cols[2].strip() else []
            alts = [alt for alt in alts if alt]
            if not word or not meaning:
                raise SystemExit(f"{path}:{line_no} missing word or meaning")
            current["words"].append({"word": word, "meaning": meaning, "alts": alts})
    return sections


def main() -> None:
    sections = parse()
    seen: dict[str, str] = {}
    chapters: dict[str, dict] = {}
    manifest: dict[str, str] = {}
    total = 0

    for section in sorted(sections, key=lambda item: sort_key(item["id"])):
        chapter_id = section["id"].split(".", 1)[0]
        if chapter_id not in CHAPTERS:
            raise SystemExit(f"No chapter metadata for {section['id']}")
        chapter = chapters.setdefault(chapter_id, {**CHAPTERS[chapter_id], "sections": []})
        words = []
        local: set[str] = set()
        for index, entry in enumerate(section["words"], 1):
            key = re.sub(r"\s+", " ", entry["word"].lower())
            if key in local:
                raise SystemExit(f"Duplicate in {section['id']}: {entry['word']}")
            if key in seen:
                raise SystemExit(f"Duplicate {entry['word']!r} in {seen[key]} and {section['id']}")
            local.add(key)
            seen[key] = section["id"]
            filename = audio_file(entry["word"])
            manifest.setdefault(filename, entry["word"])
            words.append(
                {
                    "id": f"{section['id']}-{index:03d}",
                    "word": entry["word"],
                    "meaning": entry["meaning"],
                    "alts": entry["alts"],
                    "audio": filename,
                }
            )
        total += len(words)
        chapter["sections"].append(
            {
                "id": section["id"],
                "title": section["title"],
                "hint": section["hint"],
                "words": words,
            }
        )

    order = ["3", "4", "5", "11"]
    corpus = {
        "voice": "en-GB-SoniaNeural",
        "note": "自编听写词表，按语料库第 3、4、5、11 章的练习结构分组，不是教材原文。",
        "wordCount": total,
        "sectionCount": sum(len(chapters[key]["sections"]) for key in order),
        "chapters": [chapters[key] for key in order],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MANIFEST.write_text(
        json.dumps(
            [{"file": name, "text": text} for name, text in sorted(manifest.items())],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"words {total}")
    print(f"sections {corpus['sectionCount']}")
    print(f"audio files {len(manifest)}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
