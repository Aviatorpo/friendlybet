#!/usr/bin/env python3
"""Post-process FriendlyBet World Cup story images."""

from __future__ import annotations

import argparse
import hashlib
import math
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
    im.convert("RGB").save(dest, "PNG", optimize=False, compress_level=3)


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
    im.convert("RGB").save(dest, "PNG", optimize=False, compress_level=3)


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


TEAM_PALETTES = {
    "ARG": ((117, 170, 219), (245, 248, 255), (22, 48, 92)),
    "BEL": ((214, 31, 38), (20, 22, 28), (247, 210, 70)),
    "BRA": ((245, 220, 55), (21, 120, 65), (20, 56, 135)),
    "CAN": ((211, 28, 45), (248, 248, 246), (30, 32, 36)),
    "CIV": ((242, 122, 32), (248, 248, 248), (37, 138, 76)),
    "COD": ((25, 116, 214), (238, 28, 37), (250, 220, 60)),
    "ECU": ((244, 211, 44), (35, 70, 160), (210, 34, 45)),
    "ENG": ((248, 248, 246), (40, 50, 70), (200, 30, 45)),
    "FRA": ((30, 57, 150), (244, 244, 244), (220, 40, 55)),
    "GER": ((245, 245, 241), (24, 25, 28), (212, 42, 45)),
    "MAR": ((190, 33, 46), (36, 125, 80), (245, 245, 235)),
    "MEX": ((26, 126, 82), (248, 248, 244), (204, 38, 55)),
    "NED": ((239, 105, 36), (245, 245, 245), (30, 64, 120)),
    "NOR": ((196, 30, 58), (245, 245, 245), (24, 54, 120)),
    "PAR": ((218, 38, 55), (245, 245, 245), (38, 65, 150)),
    "SEN": ((34, 138, 78), (248, 218, 67), (210, 44, 56)),
    "SWE": ((36, 82, 164), (248, 205, 45), (248, 248, 245)),
    "USA": ((38, 64, 140), (245, 245, 245), (194, 38, 58)),
}


def _palette(code: str) -> tuple[tuple[int, int, int], tuple[int, int, int], tuple[int, int, int]]:
    if code in TEAM_PALETTES:
        return TEAM_PALETTES[code]
    base = _hash_color(code)
    accent = _blend(base, (248, 248, 242), 0.45)
    dark = _blend(base, (8, 10, 16), 0.55)
    return base, accent, dark


def _player_traits(player: str) -> dict[str, tuple[int, int, int] | str]:
    name = player.lower()
    traits = {
        "skin": (178, 119, 82),
        "hair": (31, 24, 20),
        "hair_style": "short",
    }
    if "mbappe" in name:
        traits.update({"skin": (118, 78, 55), "hair": (18, 18, 18), "hair_style": "crop"})
    elif "haaland" in name:
        traits.update({"skin": (232, 188, 145), "hair": (232, 205, 105), "hair_style": "long"})
    elif "jimenez" in name:
        traits.update({"skin": (194, 135, 91), "hair": (34, 27, 23), "hair_style": "beard"})
    elif "valencia" in name or "kessie" in name:
        traits.update({"skin": (103, 68, 47), "hair": (18, 16, 15), "hair_style": "short"})
    elif "lindelof" in name:
        traits.update({"skin": (226, 178, 134), "hair": (116, 74, 42), "hair_style": "short"})
    return traits


def _draw_noise(im: Image.Image, opacity: int = 18) -> None:
    px = im.load()
    digest = hashlib.sha256(b"friendlybet-story-noise").digest()
    for y in range(0, SIZE[1], 2):
        for x in range(0, SIZE[0], 2):
            v = (digest[(x + y) % len(digest)] + x * 17 + y * 29) % 255
            delta = int((v - 127) * opacity / 255)
            r, g, b, a = px[x, y]
            color = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
                a,
            )
            px[x, y] = color


def _stroked_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont, fill, stroke=(0, 0, 0, 220), stroke_width: int = 3, anchor: str | None = None) -> None:
    draw.text(xy, text, font=font, fill=fill, stroke_fill=stroke, stroke_width=stroke_width, anchor=anchor)


def _draw_stadium(d: ImageDraw.ImageDraw, home_code: str, away_code: str, winner_code: str) -> None:
    home_main, home_accent, home_dark = _palette(home_code)
    away_main, away_accent, away_dark = _palette(away_code)
    winner_main, winner_accent, _ = _palette(winner_code)

    for y in range(SIZE[1]):
        t = y / SIZE[1]
        top = _blend((5, 8, 16), _blend(home_dark, away_dark, 0.45), 0.28)
        bottom = _blend((14, 18, 28), winner_main, 0.18)
        d.line([(0, y), (SIZE[0], y)], fill=(*_blend(top, bottom, t), 255))

    d.rectangle([0, 0, SIZE[0], 305], fill=(3, 5, 12, 210))
    d.polygon([(0, 240), (SIZE[0], 80), (SIZE[0], 530), (0, 690)], fill=(*home_main, 88))
    d.polygon([(0, 430), (SIZE[0], 275), (SIZE[0], 700), (0, 890)], fill=(*away_main, 72))
    d.rectangle([0, 1002, SIZE[0], 1288], fill=(7, 9, 15, 218))
    d.rectangle([0, 1470, SIZE[0], SIZE[1]], fill=(5, 6, 11, 232))

    for cx, cy, radius, color in [
        (170, 230, 210, home_accent),
        (760, 250, 240, away_accent),
        (480, 160, 260, winner_accent),
    ]:
        glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color, 65))
        glow = glow.filter(ImageFilter.GaussianBlur(48))
        d.bitmap((0, 0), glow, fill=None)

    for x in range(-80, SIZE[0] + 120, 135):
        d.line([(x, 300), (x + 80, 0)], fill=(255, 255, 255, 42), width=5)
        d.line([(x + 40, 0), (x + 150, 330)], fill=(255, 255, 255, 24), width=4)
    for y in [650, 720, 790, 860]:
        d.arc([-80, y, 240, y + 150], 200, 345, fill=(255, 255, 255, 32), width=3)
        d.arc([690, y - 30, 1010, y + 120], 195, 340, fill=(255, 255, 255, 28), width=3)

    for i in range(180):
        x = (i * 137 + 41) % SIZE[0]
        y = 315 + ((i * 71 + 23) % 570)
        color = [home_accent, away_accent, winner_accent, (250, 245, 225)][i % 4]
        d.ellipse([x, y, x + 3 + (i % 4), y + 3 + (i % 4)], fill=(*color, 120))


def _draw_player(d: ImageDraw.ImageDraw, cx: int, top: int, scale: float, team_code: str, player: str, number: str, winner: bool) -> None:
    main, accent, dark = _palette(team_code)
    traits = _player_traits(player)
    skin = traits["skin"]  # type: ignore[index]
    hair = traits["hair"]  # type: ignore[index]
    hair_style = str(traits["hair_style"])

    s = scale
    head_w = int(98 * s)
    head_h = int(122 * s)
    neck_w = int(42 * s)
    shoulder_w = int(245 * s)
    torso_h = int(245 * s)
    torso_top = top + int(128 * s)
    torso_bottom = torso_top + torso_h

    shadow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([cx - int(170 * s), torso_bottom + int(70 * s), cx + int(170 * s), torso_bottom + int(125 * s)], fill=(0, 0, 0, 125))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    d.bitmap((0, 0), shadow, fill=None)

    arm_y = torso_top + int(55 * s)
    if winner:
        d.line([(cx - int(110 * s), arm_y), (cx - int(205 * s), top + int(65 * s))], fill=(*skin, 255), width=int(30 * s))
        d.line([(cx + int(108 * s), arm_y), (cx + int(210 * s), top + int(70 * s))], fill=(*skin, 255), width=int(30 * s))
        d.ellipse([cx - int(230 * s), top + int(38 * s), cx - int(190 * s), top + int(78 * s)], fill=(*skin, 255))
        d.ellipse([cx + int(190 * s), top + int(42 * s), cx + int(230 * s), top + int(82 * s)], fill=(*skin, 255))
    else:
        d.line([(cx - int(110 * s), arm_y), (cx - int(185 * s), torso_top + int(210 * s))], fill=(*skin, 255), width=int(30 * s))
        d.line([(cx + int(108 * s), arm_y), (cx + int(185 * s), torso_top + int(205 * s))], fill=(*skin, 255), width=int(30 * s))

    d.rounded_rectangle(
        [cx - shoulder_w // 2, torso_top, cx + shoulder_w // 2, torso_bottom],
        radius=int(34 * s),
        fill=(*main, 255),
        outline=(*accent, 230),
        width=max(3, int(6 * s)),
    )
    d.polygon([
        (cx - shoulder_w // 2, torso_top + int(22 * s)),
        (cx - int(44 * s), torso_top),
        (cx + int(44 * s), torso_top),
        (cx + shoulder_w // 2, torso_top + int(22 * s)),
        (cx + int(100 * s), torso_top + int(95 * s)),
        (cx - int(100 * s), torso_top + int(95 * s)),
    ], fill=(*_blend(main, accent, 0.16), 255))
    d.rectangle([cx - int(8 * s), torso_top + int(18 * s), cx + int(8 * s), torso_bottom - int(24 * s)], fill=(*accent, 100))

    number_text = str(number or "").strip()
    if number_text:
        num_font = _font("C:/Windows/Fonts/impact.ttf", int(122 * s))
        _stroked_text(d, (cx, torso_top + int(83 * s)), number_text, num_font, fill=(252, 249, 240, 255), stroke=(*dark, 245), stroke_width=max(3, int(5 * s)), anchor="mm")

    d.rectangle([cx - neck_w // 2, top + int(106 * s), cx + neck_w // 2, top + int(154 * s)], fill=(*skin, 255))
    d.ellipse([cx - head_w // 2, top, cx + head_w // 2, top + head_h], fill=(*skin, 255), outline=(0, 0, 0, 80), width=2)
    if hair_style == "long":
        d.ellipse([cx - int(62 * s), top - int(10 * s), cx + int(62 * s), top + int(70 * s)], fill=(*hair, 255))
        d.rectangle([cx - int(54 * s), top + int(40 * s), cx + int(54 * s), top + int(96 * s)], fill=(*hair, 235))
        d.ellipse([cx - head_w // 2, top + int(22 * s), cx + head_w // 2, top + head_h], fill=(*skin, 255))
    elif hair_style == "crop":
        d.pieslice([cx - head_w // 2, top - int(8 * s), cx + head_w // 2, top + int(64 * s)], 180, 360, fill=(*hair, 255))
    else:
        d.pieslice([cx - head_w // 2, top - int(10 * s), cx + head_w // 2, top + int(70 * s)], 180, 360, fill=(*hair, 255))
    if hair_style == "beard":
        d.arc([cx - int(38 * s), top + int(58 * s), cx + int(38 * s), top + int(120 * s)], 15, 165, fill=(*hair, 210), width=int(9 * s))

    eye_y = top + int(61 * s)
    d.ellipse([cx - int(27 * s), eye_y, cx - int(16 * s), eye_y + int(7 * s)], fill=(20, 20, 20, 220))
    d.ellipse([cx + int(16 * s), eye_y, cx + int(27 * s), eye_y + int(7 * s)], fill=(20, 20, 20, 220))
    mouth_y = top + int(94 * s)
    if winner:
        d.arc([cx - int(25 * s), mouth_y - int(10 * s), cx + int(25 * s), mouth_y + int(22 * s)], 20, 160, fill=(80, 35, 35, 220), width=max(2, int(3 * s)))
    else:
        d.arc([cx - int(25 * s), mouth_y, cx + int(25 * s), mouth_y + int(28 * s)], 200, 340, fill=(80, 35, 35, 220), width=max(2, int(3 * s)))

    shine = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    shd = ImageDraw.Draw(shine)
    shd.line([(cx - int(98 * s), torso_top + int(12 * s)), (cx + int(80 * s), torso_bottom - int(35 * s))], fill=(255, 255, 255, 42), width=int(10 * s))
    shine = shine.filter(ImageFilter.GaussianBlur(2))
    d.bitmap((0, 0), shine, fill=None)


def _blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def _fit(draw: ImageDraw.ImageDraw, text: str, start: int, minimum: int, max_width: int) -> ImageFont.ImageFont:
    return _fit_font(draw, text, "C:/Windows/Fonts/impact.ttf", max_width, start, minimum)


def outcome_base(dest: Path, home_code: str, away_code: str, home_name: str, away_name: str, outcome_code: str, outcome_name: str, winner_player: str = "", winner_number: str = "", loser_player: str = "", loser_number: str = "") -> None:
    winner_code = home_code if outcome_code == "DRAW" else outcome_code
    loser_code = away_code if outcome_code == "DRAW" else (away_code if outcome_code == home_code else home_code)
    winner_player = winner_player or outcome_name
    loser_player = loser_player or (away_name if winner_code == home_code else home_name)

    im = Image.new("RGBA", SIZE, (8, 10, 16, 255))
    d = ImageDraw.Draw(im, "RGBA")
    _draw_stadium(d, home_code, away_code, winner_code)

    _draw_player(d, 320, 368, 1.14, winner_code, winner_player, winner_number, True)
    _draw_player(d, 660, 420, 0.96, loser_code, loser_player, loser_number, False)

    # A subtle foreground rim keeps the lower story-caption band clean without
    # becoming the old flat placeholder card.
    d.rectangle([0, 1002, SIZE[0], 1288], fill=(5, 7, 13, 202))
    for x in range(-90, SIZE[0] + 120, 180):
        d.arc([x, 1040, x + 320, 1260], 205, 340, fill=(255, 255, 255, 22), width=3)

    d.rectangle([0, 1470, SIZE[0], SIZE[1]], fill=(5, 6, 11, 230))
    _draw_noise(im, 20)

    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(dest, "PNG", optimize=False, compress_level=3)


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
    ob.add_argument("winner_player", nargs="?")
    ob.add_argument("winner_number", nargs="?")
    ob.add_argument("loser_player", nargs="?")
    ob.add_argument("loser_number", nargs="?")
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
            args.winner_player or "",
            args.winner_number or "",
            args.loser_player or "",
            args.loser_number or "",
        )


if __name__ == "__main__":
    main()
