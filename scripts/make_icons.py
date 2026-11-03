#!/usr/bin/env python3
"""Draw the PWA icon: a brass sound-mark on ink."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def draw(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=(16, 20, 27, 255))
    cx = cy = size / 2
    brass = (228, 180, 92, 255)
    ink = (16, 20, 27, 255)
    outer = size * 0.30
    draw.ellipse((cx - outer, cy - outer, cx + outer, cy + outer), outline=brass, width=max(4, size // 28))
    bar_w = size * 0.045
    gap = size * 0.07
    heights = (0.16, 0.28, 0.20)
    total = bar_w * 3 + gap * 2
    left = cx - total / 2
    for index, height in enumerate(heights):
        h = size * height
        x = left + index * (bar_w + gap)
        draw.rounded_rectangle((x, cy - h / 2, x + bar_w, cy + h / 2), radius=bar_w / 2, fill=brass)
    # A small ink cut so the mark reads as a speaker core, not a target.
    draw.ellipse(
        (cx - size * 0.055, cy - size * 0.055, cx + size * 0.055, cy + size * 0.055),
        fill=ink,
    )
    return image


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png")):
        draw(size).save(PUBLIC / name)
        print(name)


if __name__ == "__main__":
    main()
