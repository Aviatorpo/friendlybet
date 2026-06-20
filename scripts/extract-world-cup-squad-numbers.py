#!/usr/bin/env python3
"""Extract World Cup squad shirt numbers from Codex/SquadLists-English.pdf.

The FIFA PDF places the numbers 1..26 at the bottom of each page, so the row
order is the source of truth: roster row 1 is shirt #1, row 2 is shirt #2, etc.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = ROOT / "Codex" / "SquadLists-English.pdf"
DEFAULT_OUTPUT = ROOT / "story-assets" / "world-cup-squad-shirt-numbers.json"
CODE_ALIASES = {
    "CUW": "CUR",
    "KSA": "SAU",
}


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def extract_rows(text: str) -> list[str]:
    rows: list[str] = []
    in_rows = False
    for line in text.splitlines():
        if re.match(r"^#\s*POS", line):
            in_rows = True
            continue
        if line.startswith("ROLE COACH"):
            break
        if in_rows and re.match(r"^(GK|DF|MF|FW)", line):
            rows.append(line)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default=str(DEFAULT_PDF))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        raise SystemExit(f"Squad list PDF not found: {pdf_path}")

    reader = PdfReader(str(pdf_path))
    teams = {}
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        header = re.search(r"^(.+?) \(([A-Z]{3})\)", text, re.M)
        if not header:
            raise SystemExit(f"Could not identify team header on PDF page {page_number}")

        pdf_code = header.group(2)
        code = CODE_ALIASES.get(pdf_code, pdf_code)
        rows = extract_rows(text)
        if len(rows) != 26:
            raise SystemExit(f"{code}: expected 26 roster rows from PDF page {page_number}, got {len(rows)}")

        players = []
        for idx, row in enumerate(rows, start=1):
            players.append({
                "number": idx,
                "raw": row,
                "normalized": normalize(row),
            })
        teams[code] = {
            "pdf_code": pdf_code,
            "team": header.group(1),
            "page": page_number,
            "players": players,
        }

    output = {
        "source": "Codex/SquadLists-English.pdf",
        "source_sha256": sha256(pdf_path),
        "extraction_rule": "PDF roster row order maps to shirt numbers 1..26.",
        "teams": dict(sorted(teams.items())),
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted shirt-number rosters for {len(teams)} teams to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
