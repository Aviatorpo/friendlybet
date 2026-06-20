#!/usr/bin/env python3
"""Deterministic visual audit for FriendlyBet World Cup story images.

This does not use any remote AI/API. It enforces the parts of the story-image
skill that can be checked locally before production publishes an asset.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parents[1]
STORIES_PATH = ROOT / "public-data" / "world-cup-stories.json"
MANIFEST_PATH = ROOT / "story-assets" / "manifest.json"
PROMPT_INDEX_PATH = ROOT / "story-assets" / "outcome-bases" / "prompt-index.json"
SQUAD_NUMBERS_PATH = ROOT / "story-assets" / "world-cup-squad-shirt-numbers.json"
OUTCOME_BASE_DIR = ROOT / "story-assets" / "outcome-bases"
EXPECTED_SIZE = (941, 1672)

SAFE_BAND = (0.60, 0.77)
TOP_BAND = (0.0, 0.17)
BOTTOM_WATERMARK_BAND = (0.88, 0.985)

FORBIDDEN_TEXT = re.compile(
    r"biggest current star|current star|#current|generic player|unnamed player|placeholder player",
    re.I,
)
PLAYER_LINE = re.compile(r":\s*([^,\n]+),\s*([^,\n]+),\s*shirt number #(\d+)", re.I)
TEAM_SUFFIX = re.compile(r"\s+national(?:-[a-z]+)?\s+kit.*$", re.I)


@dataclass(frozen=True)
class AuditTarget:
    kind: str
    image: str
    source: str
    prompt: str = ""


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def key_tokens(value: str) -> list[str]:
    return [token for token in normalize(value).split() if token not in {"jr", "junior", "fc"}]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def image_path(image: str) -> Path:
    return ROOT / image.replace("\\", "/")


def squad_data() -> dict:
    return load_json(SQUAD_NUMBERS_PATH, {"teams": {}})


def team_name_index(squads: dict) -> dict[str, str]:
    index = {}
    for code, data in (squads.get("teams") or {}).items():
        for name in [code, data.get("team") or ""]:
            normalized = normalize(str(name))
            if normalized:
                index[normalized] = code
    aliases = {
        "cabo verde": "CPV",
        "cape verde": "CPV",
        "curacao": "CUR",
        "cura ao": "CUR",
        "czech republic": "CZE",
        "czechia": "CZE",
        "dr congo": "COD",
        "congo dr": "COD",
        "ivory coast": "CIV",
        "cote d ivoire": "CIV",
        "iran": "IRN",
        "ir iran": "IRN",
        "saudi arabia": "SAU",
        "korea republic": "KOR",
        "south korea": "KOR",
        "south africa": "RSA",
        "turkiye": "TUR",
        "turkey": "TUR",
        "usa": "USA",
    }
    index.update(aliases)
    return index


def story_targets() -> list[AuditTarget]:
    payload = load_json(STORIES_PATH, {"items": []})
    targets = []
    for story in payload.get("items", []):
        image = str(story.get("image") or "")
        if image:
            targets.append(AuditTarget("story", image, str(story.get("id") or story.get("match_id") or image)))

    manifest = load_json(MANIFEST_PATH, {"items": []})
    for item in manifest.get("items", []):
        for outcome, image in (item.get("outcomes") or {}).items():
            image = str(image or "")
            if image and "/outcome-bases/" not in image:
                targets.append(AuditTarget("story", image, f"manifest:{item.get('match_id')}:{outcome}"))
    return dedupe(targets)


def base_targets() -> list[AuditTarget]:
    prompt_index = load_json(PROMPT_INDEX_PATH, {"prompts": []})
    targets = []
    for item in prompt_index.get("prompts", []):
        image = str(item.get("image") or "")
        if image and image_path(image).exists():
            targets.append(
                AuditTarget(
                    "base",
                    image,
                    f"prompt-index:{item.get('match_key')}:{item.get('outcome')}",
                    str(item.get("prompt") or ""),
                )
            )

    indexed = {target.image for target in targets}
    if OUTCOME_BASE_DIR.exists():
        for path in OUTCOME_BASE_DIR.glob("*.png"):
            if path.name.startswith("contact-sheet"):
                continue
            image = rel(path)
            if image not in indexed:
                targets.append(AuditTarget("base", image, f"unindexed:{path.name}", ""))
    return dedupe(targets)


def dedupe(targets: Iterable[AuditTarget]) -> list[AuditTarget]:
    seen = set()
    out = []
    for target in targets:
        key = (target.kind, target.image)
        if key in seen:
            continue
        seen.add(key)
        out.append(target)
    return out


def crop_band(im: Image.Image, band: tuple[float, float]) -> Image.Image:
    width, height = im.size
    return im.crop((0, int(height * band[0]), width, int(height * band[1])))


def luminance(im: Image.Image) -> Image.Image:
    return im.convert("RGB").convert("L")


def bright_ratio(im: Image.Image, threshold: int) -> float:
    lum = luminance(im)
    total = lum.width * lum.height
    if not total:
        return 0.0
    hist = lum.histogram()
    return sum(hist[threshold:]) / total


def stat_summary(im: Image.Image) -> dict[str, float]:
    lum = luminance(im)
    stat = ImageStat.Stat(lum)
    return {
        "mean": float(stat.mean[0]),
        "stddev": float(stat.stddev[0]),
    }


def edge_mean(im: Image.Image) -> float:
    edges = luminance(im).filter(ImageFilter.FIND_EDGES)
    return float(ImageStat.Stat(edges).mean[0])


def assert_prompt(target: AuditTarget, errors: list[str]) -> None:
    prompt = target.prompt
    if not prompt:
        errors.append("missing prompt-index metadata for named-player/shirt-number audit")
        return
    if FORBIDDEN_TEXT.search(prompt):
        errors.append("prompt contains forbidden generic/current-player wording")
    required = [
        "Create a vertical 9:16 premium sports meme-card base image",
        "high-end illustrated sports caricature poster",
        "not photorealistic",
        "not a real photo",
        "not a deepfake",
        "Show exactly two football stars",
        "shirt number #",
        "printed naturally into the jersey fabric",
        "Leave the lower-middle band around 60%-77%",
        "Do not place faces in that band",
        "Leave the lower edge visually calm",
        "Avoid: score text, result title, yellow result headline",
    ]
    for phrase in required:
        if phrase not in prompt:
            errors.append(f"prompt missing required skill phrase: {phrase}")
    players = PLAYER_LINE.findall(prompt)
    if len(players) != 2:
        errors.append("prompt must identify exactly two named players with shirt numbers")
    squads = squad_data()
    teams = squads.get("teams") or {}
    if not teams:
        errors.append("missing PDF-derived squad shirt-number data")
    team_index = team_name_index(squads)
    for player, team_text, number in players:
        if not player.strip() or player.strip().lower() in {"player", "star", "current star"}:
            errors.append("prompt has an unnamed or generic player")
        if not number.isdigit() or int(number) <= 0:
            errors.append(f"invalid shirt number for {player.strip() or 'player'}")
            continue
        team_name = TEAM_SUFFIX.sub("", team_text).strip()
        code = team_index.get(normalize(team_name))
        if not code:
            errors.append(f"could not map prompt team to squad PDF roster: {team_name}")
            continue
        roster = teams.get(code, {}).get("players") or []
        idx = int(number) - 1
        if idx < 0 or idx >= len(roster):
            errors.append(f"{team_name} #{number} is outside the PDF squad range")
            continue
        row = roster[idx]
        row_text = str(row.get("normalized") or normalize(row.get("raw") or ""))
        missing = [token for token in key_tokens(player) if token not in row_text]
        if missing:
            raw = str(row.get("raw") or "")
            errors.append(
                f"{player.strip()} #{number} does not match PDF row for {team_name} #{number}: {raw[:140]}"
            )


def audit_image(target: AuditTarget) -> tuple[list[str], dict[str, float | str]]:
    errors: list[str] = []
    metrics: dict[str, float | str] = {"kind": target.kind, "image": target.image}
    path = image_path(target.image)
    if not path.exists():
        return [f"missing image: {target.image}"], metrics
    if path.suffix.lower() != ".png":
        errors.append("image must be a PNG")

    try:
        im = Image.open(path).convert("RGB")
    except Exception as exc:  # pragma: no cover - message is enough in CI
        return [f"cannot open image: {exc}"], metrics

    metrics["width"], metrics["height"] = im.size
    if im.size != EXPECTED_SIZE:
        errors.append(f"wrong dimensions {im.size[0]}x{im.size[1]}, expected {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]}")

    whole = stat_summary(im)
    metrics["luma_mean"] = round(whole["mean"], 2)
    metrics["luma_stddev"] = round(whole["stddev"], 2)
    if not (28 <= whole["mean"] <= 150):
        errors.append(f"image exposure out of range: mean luminance {whole['mean']:.1f}")
    if whole["stddev"] < 32:
        errors.append(f"image lacks visual contrast: luminance stddev {whole['stddev']:.1f}")

    safe = crop_band(im, SAFE_BAND)
    safe_stat = stat_summary(safe)
    safe_edge = edge_mean(safe)
    metrics["safe_band_stddev"] = round(safe_stat["stddev"], 2)
    metrics["safe_band_edge_mean"] = round(safe_edge, 2)
    if safe_edge > 48:
        errors.append(f"caption safe band is too visually busy: edge mean {safe_edge:.1f}")
    if safe_stat["stddev"] > 92:
        errors.append(f"caption safe band has too much contrast: stddev {safe_stat['stddev']:.1f}")

    top = crop_band(im, TOP_BAND)
    top_bright = bright_ratio(top, 230)
    metrics["top_bright_ratio"] = round(top_bright, 4)
    if target.kind == "story":
        if top_bright < 0.015:
            errors.append("final story top band lacks visible baked white title/score text")
        watermark_band = crop_band(im, BOTTOM_WATERMARK_BAND)
        wm_mid = bright_ratio(watermark_band, 170)
        wm_hi = bright_ratio(watermark_band, 220)
        metrics["watermark_mid_ratio"] = round(wm_mid, 4)
        metrics["watermark_high_ratio"] = round(wm_hi, 4)
        if wm_mid < 0.009 and wm_hi < 0.0008:
            errors.append("final story lacks visible FriendlyBet watermark evidence near lower edge")
    else:
        assert_prompt(target, errors)
        bottom = crop_band(im, BOTTOM_WATERMARK_BAND)
        bottom_edge = edge_mean(bottom)
        metrics["bottom_edge_mean"] = round(bottom_edge, 2)
        if bottom_edge > 40:
            errors.append(f"base lower edge is too busy for deterministic watermark: edge mean {bottom_edge:.1f}")

    if any(not math.isfinite(float(v)) for v in metrics.values() if isinstance(v, (int, float))):
        errors.append("non-finite image metric")
    return errors, metrics


def select_targets(scope: str) -> list[AuditTarget]:
    if scope == "stories":
        return story_targets()
    if scope == "bases":
        return base_targets()
    return story_targets() + base_targets()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=["all", "stories", "bases"], default="all")
    parser.add_argument("--report", default="", help="Optional JSON report path")
    args = parser.parse_args()

    targets = select_targets(args.scope)
    failures = []
    report = []
    for target in targets:
        errors, metrics = audit_image(target)
        metrics["source"] = target.source
        metrics["errors"] = errors
        report.append(metrics)
        if errors:
            failures.append((target, errors))

    if args.report:
        report_path = ROOT / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps({"scope": args.scope, "count": len(targets), "items": report}, indent=2) + "\n", encoding="utf-8")

    if failures:
        print(f"World Cup story image audit failed: {len(failures)} of {len(targets)} target(s)", file=sys.stderr)
        for target, errors in failures[:40]:
            print(f"- {target.kind} {target.image} ({target.source})", file=sys.stderr)
            for error in errors:
                print(f"  * {error}", file=sys.stderr)
        if len(failures) > 40:
            print(f"... and {len(failures) - 40} more failure(s)", file=sys.stderr)
        return 1

    print(f"World Cup story image audit passed: {len(targets)} {args.scope} target(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
