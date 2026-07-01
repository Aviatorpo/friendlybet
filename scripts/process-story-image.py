#!/usr/bin/env python3
"""Post-process FriendlyBet World Cup story images."""

from __future__ import annotations

import argparse
import hashlib
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
    im = add_watermark(im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "PNG", optimize=True)


def add_watermark(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA").resize(SIZE, Image.Resampling.LANCZOS)
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

    return Image.alpha_composite(im, overlay)


def _fit_font(draw: ImageDraw.ImageDraw, text: str, font_path: str, max_width: int, start_size: int, min_size: int) -> ImageFont.ImageFont:
    size = start_size
    while size >= min_size:
        font = _font(font_path, size)
        box = draw.textbbox((0, 0), text, font=font, stroke_width=3)
        if box[2] - box[0] <= max_width:
            return font
        size -= 2
    return _font(font_path, min_size)


def _centered_stroked(draw: ImageDraw.ImageDraw, y: int, text: str, font: ImageFont.ImageFont, fill=(247, 246, 242, 255), stroke=(20, 18, 15, 220), stroke_width: int = 3) -> None:
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    x = (SIZE[0] - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font, fill=fill, stroke_fill=stroke, stroke_width=stroke_width)


def result_card(src: Path, dest: Path, title: str, subtitle: str) -> None:
    im = Image.open(src).convert("RGBA").resize(SIZE, Image.Resampling.LANCZOS)
    d = ImageDraw.Draw(im)

    title = title.strip().upper()
    subtitle = subtitle.strip().upper()
    title_font = _fit_font(d, title, "C:/Windows/Fonts/impact.ttf", 845, 96, 52)
    subtitle_font = _fit_font(d, subtitle, "C:/Windows/Fonts/seguisb.ttf", 760, 42, 28)

    title_band = Image.new("RGBA", im.size, (0, 0, 0, 0))
    td = ImageDraw.Draw(title_band, "RGBA")
    for y in range(0, 315):
        alpha = int(238 * (1 - y / 315) + 72 * (y / 315))
        td.line([(0, y), (SIZE[0], y)], fill=(5, 6, 9, alpha))
    im.alpha_composite(title_band)

    # Keep all result text in the top band, away from faces and the caption panel.
    _centered_stroked(d, 74, title, title_font, stroke_width=4)
    _centered_stroked(d, 178, subtitle, subtitle_font, stroke_width=2)

    im = add_watermark(im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "PNG", optimize=True)


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


def _hash_color(code: str) -> tuple[int, int, int]:
    digest = hashlib.sha256(code.encode("utf-8")).digest()
    return (
        72 + digest[0] % 132,
        58 + digest[1] % 124,
        54 + digest[2] % 126,
    )


def _blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def _fit(draw: ImageDraw.ImageDraw, text: str, start: int, minimum: int, max_width: int) -> ImageFont.ImageFont:
    return _fit_font(draw, text, "C:/Windows/Fonts/impact.ttf", max_width, start, minimum)


def outcome_base(dest: Path, home_code: str, away_code: str, home_name: str, away_name: str, outcome_code: str, outcome_name: str) -> None:
    home_color = _hash_color(home_code)
    away_color = _hash_color(away_code)
    winner_color = home_color if outcome_code == home_code else away_color
    loser_color = away_color if outcome_code == home_code else home_color
    loser_name = away_name if outcome_code == home_code else home_name

    im = Image.new("RGBA", SIZE, (12, 14, 18, 255))
    d = ImageDraw.Draw(im, "RGBA")

    for y in range(SIZE[1]):
        t = y / SIZE[1]
        base = _blend((9, 12, 18), (24, 28, 36), t)
        d.line([(0, y), (SIZE[0], y)], fill=(*base, 255))

    d.polygon([(0, 260), (SIZE[0], 120), (SIZE[0], 880), (0, 1010)], fill=(*loser_color, 74))
    d.polygon([(0, 170), (SIZE[0], 330), (SIZE[0], 760), (0, 610)], fill=(*winner_color, 156))
    d.rectangle([0, 0, SIZE[0], 300], fill=(3, 5, 10, 182))
    d.rectangle([0, int(SIZE[1] * 0.60), SIZE[0], int(SIZE[1] * 0.77)], fill=(8, 10, 15, 216))
    d.rectangle([0, int(SIZE[1] * 0.88), SIZE[0], SIZE[1]], fill=(7, 8, 12, 226))

    for x in range(-120, SIZE[0] + 160, 210):
        d.ellipse([x, 720, x + 360, 1080], outline=(*winner_color, 38), width=10)
    for x in range(-80, SIZE[0] + 160, 240):
        d.line([(x, 1090), (x + 220, 1420)], fill=(255, 255, 255, 18), width=6)

    headline_font = _fit(d, outcome_name.upper(), 104, 58, 800)
    sub_font = _fit_font(d, "ADVANCES", "C:/Windows/Fonts/seguisb.ttf", 500, 56, 36)
    vs_font = _fit_font(d, f"{home_code}  v  {away_code}", "C:/Windows/Fonts/seguisb.ttf", 600, 46, 30)
    loser_font = _fit_font(d, f"over {loser_name}", "C:/Windows/Fonts/seguisb.ttf", 720, 44, 28)

    _centered_stroked(d, 360, outcome_name.upper(), headline_font, fill=(248, 247, 242, 255), stroke=(4, 5, 8, 235), stroke_width=5)
    _centered_stroked(d, 478, "ADVANCES", sub_font, fill=(226, 198, 120, 255), stroke=(4, 5, 8, 230), stroke_width=3)
    _centered_stroked(d, 545, f"over {loser_name}", loser_font, fill=(229, 232, 236, 235), stroke=(4, 5, 8, 210), stroke_width=2)
    _centered_stroked(d, 1190, f"{home_code}  v  {away_code}", vs_font, fill=(190, 198, 210, 210), stroke=(0, 0, 0, 170), stroke_width=2)

    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    wm = sub.add_parser("watermark")
    wm.add_argument("src")
    wm.add_argument("dest")
    rc = sub.add_parser("result-card")
    rc.add_argument("src")
    rc.add_argument("dest")
    rc.add_argument("title")
    rc.add_argument("subtitle")
    cs = sub.add_parser("contact-sheet")
    cs.add_argument("dest")
    cs.add_argument("images", nargs="+")
    ob = sub.add_parser("outcome-base")
    ob.add_argument("dest")
    ob.add_argument("home_code")
    ob.add_argument("away_code")
    ob.add_argument("home_name")
    ob.add_argument("away_name")
    ob.add_argument("outcome_code")
    ob.add_argument("outcome_name")
    args = parser.parse_args()

    if args.cmd == "watermark":
        watermark(Path(args.src), Path(args.dest))
    elif args.cmd == "result-card":
        result_card(Path(args.src), Path(args.dest), args.title, args.subtitle)
    elif args.cmd == "contact-sheet":
        contact_sheet([Path(p) for p in args.images], Path(args.dest))
    elif args.cmd == "outcome-base":
        outcome_base(
            Path(args.dest),
            args.home_code,
            args.away_code,
            args.home_name,
            args.away_name,
            args.outcome_code,
            args.outcome_name,
        )


if __name__ == "__main__":
    main()
