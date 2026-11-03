#!/usr/bin/env python3
"""Pre-generate British English mp3s with edge-tts (en-GB-SoniaNeural)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "scripts" / "audio-manifest.json"
OUT_DIR = ROOT / "public" / "audio"
VOICE = "en-GB-SoniaNeural"
RATE = "-8%"
CONCURRENCY = 5


def looks_like_mp3(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 4000:
        return False
    head = path.read_bytes()[:3]
    return head.startswith(b"ID3") or head[0] == 0xFF


async def synthesize(item: dict, sem: asyncio.Semaphore) -> str:
    dest = OUT_DIR / item["file"]
    if looks_like_mp3(dest):
        return "skip"
    async with sem:
        last_error = "unknown"
        for attempt in range(5):
            tmp = dest.with_suffix(".part.mp3")
            try:
                communicate = edge_tts.Communicate(item["text"], VOICE, rate=RATE)
                await communicate.save(str(tmp))
                if not looks_like_mp3(tmp):
                    raise RuntimeError(f"bad audio ({tmp.stat().st_size if tmp.exists() else 0} bytes)")
                tmp.replace(dest)
                return "ok"
            except Exception as error:  # noqa: BLE001 - retry any TTS/network failure
                last_error = str(error)
                tmp.unlink(missing_ok=True)
                await asyncio.sleep(1.2 * (attempt + 1))
        print(f"FAIL {item['text']}: {last_error}", file=sys.stderr)
        return "fail"


async def main() -> None:
    items = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    done = 0
    counts = {"ok": 0, "skip": 0, "fail": 0}

    async def wrapped(item: dict) -> None:
        nonlocal done
        status = await synthesize(item, sem)
        counts[status] += 1
        done += 1
        if done % 25 == 0 or done == len(items):
            print(f"{done}/{len(items)} ok={counts['ok']} skip={counts['skip']} fail={counts['fail']}", flush=True)

    await asyncio.gather(*(wrapped(item) for item in items))
    failed = [item["file"] for item in items if not looks_like_mp3(OUT_DIR / item["file"])]
    total_bytes = sum((OUT_DIR / item["file"]).stat().st_size for item in items if (OUT_DIR / item["file"]).exists())
    report = {
        "voice": VOICE,
        "rate": RATE,
        "files": len(items) - len(failed),
        "missing": failed,
        "bytes": total_bytes,
    }
    (OUT_DIR / "_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
    if failed:
        raise SystemExit(f"{len(failed)} audio files missing")


if __name__ == "__main__":
    asyncio.run(main())
