#!/usr/bin/env python3
"""Post-process FriendlyBet World Cup story images."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


SIZE = (941, 1672)


def _font(path: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(path),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
        Path("C:/Windows/Fonts/seguisb.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def watermark(src: Path, dest: Path) -> None:
    im = Image.open(src).convert("RGBA").resize(SIZE, Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)

    ball = "⚽"
    word = "FriendlyBet"
    ball_font = _font("C:/Windows/Fonts/seguisym.ttf", 46)
    text_font = _font("C:/Windows/Fonts/seguisb.ttf", 38)
    gap = 14

    ball_box = gd.textbbox((0, 0), ball, font=ball_font)
    word_box = gd.textbbox((0, 0), word, font=text_font)
    ball_w = ball_box[2] - ball_box[0]
    word_w = word_box[2] - word_box[0]
    total_w = ball_w + gap + word_w
    x = (SIZE[0] - total_w) // 2
    y = 1572
    ball_y = y - 6
    word_y = y + 4

    gd.text((x, ball_y), ball, font=ball_font, fill=(217, 180, 106, 210))
    glow = glow.filter(ImageFilter.GaussianBlur(9))
    overlay.alpha_composite(glow)

    d = ImageDraw.Draw(overlay)
    for dx, dy in [(-2, 2), (0, 3), (2, 2), (0, 0)]:
        d.text((x + dx, ball_y + dy), ball, font=ball_font, fill=(0, 0, 0, 120))
        d.text((x + ball_w + gap + dx, word_y + dy), word, font=text_font, fill=(0, 0, 0, 155))
    d.text((x, ball_y), ball, font=ball_font, fill=(247, 246, 242, 255))
    d.text((x + ball_w + gap, word_y), word, font=text_font, fill=(247, 246, 242, 255))

    dest.parent.mkdir(parents=True, exist_ok=True)
    Image.alpha_composite(im, overlay).convert("RGB").save(dest, "PNG", optimize=True)


def contact_sheet(images: list[Path], dest: Path) -> None:
    thumbs = []
    for image in images:
        im = Image.open(image).convert("RGB")
        d = ImageDraw.Draw(im, "RGBA")
        y1 = int(im.height * 0.60)
        y2 = int(im.height * 0.77)
        d.rectangle([0, y1, im.width, y2], outline=(255, 0, 0, 255), width=8, fill=(255, 0, 0, 35))
        im.thumbnail((360, 640), Image.Resampling.LANCZOS)
        thumbs.append((image.name, im.copy()))

    width = sum(im.width for _, im in thumbs) + 20 * (len(thumbs) + 1)
    height = 700
    sheet = Image.new("RGB", (width, height), (18, 18, 18))
    d = ImageDraw.Draw(sheet)
    x = 20
    for name, im in thumbs:
        d.text((x, 12), name, fill=(255, 255, 255))
        sheet.paste(im, (x, 42))
        x += im.width + 20
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, "PNG")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    wm = sub.add_parser("watermark")
    wm.add_argument("src")
    wm.add_argument("dest")
    cs = sub.add_parser("contact-sheet")
    cs.add_argument("dest")
    cs.add_argument("images", nargs="+")
    args = parser.parse_args()

    if args.cmd == "watermark":
        watermark(Path(args.src), Path(args.dest))
    elif args.cmd == "contact-sheet":
        contact_sheet([Path(p) for p in args.images], Path(args.dest))


if __name__ == "__main__":
    main()
