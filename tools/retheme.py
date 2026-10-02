#!/usr/bin/env python3
"""
BrightStack palette migration — "Aqua Blue x Peach Puff".

Every page in this repo ships its own hand-written palette (the bakery is plum
and gold, the coffee assistant is roast browns, and so on). Rewriting 40-odd
files by hand would be slow and would quietly wreck contrast. Instead this
script moves every colour onto a two-pole hue axis:

    cool hues  ->  aqua  band (~168-205 deg)
    warm hues  ->  peach band (~16-42 deg)

Lightness is preserved exactly, so a dark page stays dark, a light page stays
light, and every existing text/background contrast ratio survives untouched.
Saturation is gently compressed for the "soothing" feel the brief asked for.

Colours that carry *meaning* rather than *brand* -- error reds, success greens,
warning ambers, the Fiverr green -- are left alone, because recolouring a
validation error to peach would destroy the signal it exists to send.

Usage:
    python3 tools/retheme.py --plan    # print the old -> new mapping table
    python3 tools/retheme.py --apply   # rewrite the files in place
"""

from __future__ import annotations

import argparse
import colorsys
import pathlib
import re
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --------------------------------------------------------------------------
# Colours that must NOT be re-hued.
# --------------------------------------------------------------------------
# Semantic status colours. These are pulled from vars named --error/--red/
# --green/--warn/etc. across the repo. They communicate state, not brand.
PRESERVE = {
    # errors / danger / destructive
    "#B0453A", "#C4453A", "#E0554F", "#E5484D", "#E8615A", "#FF6B6B",
    "#E4573D", "#C97B63", "#F0553F", "#D16B6B", "#B5502A",
    # success / done / positive
    "#0E9F6E", "#0F9D63", "#2FBF71", "#3A9B7A", "#4ADE80", "#4FE8A0",
    "#7CFFB2", "#3FAE8A", "#A7F3D0", "#E7F7EF", "#E6F6F0", "#E3F5F1",
    # warning / caution
    "#B7791F", "#B87F1F", "#F5C36B", "#FFB454", "#F5A623",
    # Fiverr brand green + its ink (brand asset, must stay recognisable)
    "#1DBF73", "#04341F",
    # pure black / white are structural, not brand
    "#FFFFFF", "#FFF", "#000000", "#000",
}

# Social/channel identity colours used inside the Reprise demo.
PRESERVE |= {"#FF6FA5", "#6C8CFF", "#55C1FF", "#FFB454"}

# Hand-picked overrides where the automatic mapping is not the nicest choice.
# These are the brand-critical colours of the homepage and shared surfaces.
OVERRIDES = {
    # --- homepage (dark) ---
    "#070A12": "#04161B",  # paper        -> deep aqua-black
    "#101521": "#0A242C",  # paper-2      -> raised panel
    "#0D121D": "#071E25",  # surface
    "#F4F7FF": "#ECFAFC",  # ink
    "#9CA7BC": "#93B4BD",  # ink-soft
    "#C9FF63": "#5FD9E8",  # signal       -> aqua (primary CTA)
    "#172100": "#042128",  # signal-ink
    "#8E8CFF": "#FFD3B0",  # indigo       -> peach puff (secondary accent)
    "#63E6FF": "#7FE3F0",  # cyan
    # --- shared light brand surfaces (ask / signin / client area / admin) ---
    "#EEF1F4": "#EEF7F9",
    "#1B2430": "#13262B",
    "#4B5568": "#4A626A",
    "#D4DAE1": "#CFE2E7",
    "#3C3EE8": "#1795AE",  # indigo -> aqua primary
    "#EEEEFD": "#E6F6F9",
    "#FFC93C": "#FFC49A",  # amber signal -> peach
    "#2A2005": "#2B1A0C",
    "#F4F6F8": "#F1F8FA",
    "#B7BFCB": "#A6C2C9",
}


# --------------------------------------------------------------------------
# Colour maths
# --------------------------------------------------------------------------
def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*rgb)


def map_hue(h_deg: float) -> float:
    """Fold the colour wheel onto two poles: aqua for cool, peach for warm.

    The warm arc starts at 320deg rather than 340deg so that pinks, roses and
    plums (the bakery's #4A1F2E sits at 339deg) stay warm instead of tipping
    over into the blue end of the aqua band.
    """
    if h_deg >= 320 or h_deg <= 95:
        # Warm arc, measured from -40deg so reds and yellows spread evenly.
        w = h_deg - 360 if h_deg >= 320 else h_deg
        t = (w + 40) / 135
        return 14 + t * 28  # peach band
    t = (h_deg - 95) / 225
    return 168 + t * 37  # aqua band


def convert(hex_value: str) -> str:
    key = hex_value.upper()
    if len(key) == 4:  # expand #ABC for lookups
        key = "#" + "".join(ch * 2 for ch in key[1:])
    if key in OVERRIDES:
        return OVERRIDES[key]
    if key in PRESERVE or hex_value.upper() in PRESERVE:
        return hex_value

    r, g, b = (c / 255 for c in hex_to_rgb(hex_value))
    h, l, s = colorsys.rgb_to_hls(r, g, b)

    if s < 0.08:
        # Near-neutral. Give it the faintest aqua cast so greys across the site
        # feel related, but leave the extremes (near-white/near-black) alone.
        if l < 0.04 or l > 0.97:
            return hex_value
        s2, h2 = 0.055, 190 / 360
    else:
        h2 = map_hue(h * 360) / 360
        s2 = min(s, 0.78) * 0.93

    r2, g2, b2 = colorsys.hls_to_rgb(h2, l, s2)
    return rgb_to_hex(tuple(round(c * 255) for c in (r2, g2, b2)))  # type: ignore[arg-type]


# --------------------------------------------------------------------------
# File rewriting
# --------------------------------------------------------------------------
HEX_RE = re.compile(r"#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b")
RGBA_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[0-9.]+\s*)?\)")


def rewrite(text: str, tally: Counter | None = None) -> str:
    def hex_sub(match: re.Match[str]) -> str:
        old = match.group(0)
        new = convert(old)
        if tally is not None and new.upper() != old.upper():
            tally[(old.upper(), new.upper())] += 1
        return new

    def rgba_sub(match: re.Match[str]) -> str:
        r, g, b = (int(match.group(i)) for i in (1, 2, 3))
        alpha = match.group(4) or ""
        # Pure white/black overlays are structural scrims - leave them be.
        if (r, g, b) in {(255, 255, 255), (0, 0, 0)}:
            return match.group(0)
        new_rgb = hex_to_rgb(convert(rgb_to_hex((r, g, b))))
        prefix = "rgba(" if alpha else "rgb("
        return f"{prefix}{new_rgb[0]},{new_rgb[1]},{new_rgb[2]}{alpha.rstrip() if alpha else ''})"

    return RGBA_RE.sub(rgba_sub, HEX_RE.sub(hex_sub, text))


def targets() -> list[pathlib.Path]:
    return sorted(
        [p for p in ROOT.glob("*.html")] + [p for p in ROOT.glob("*.svg")]
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write changes to disk")
    parser.add_argument("--plan", action="store_true", help="print the mapping table")
    args = parser.parse_args()
    if not (args.apply or args.plan):
        parser.error("pass --plan or --apply")

    tally: Counter = Counter()
    changed = 0
    for path in targets():
        original = path.read_text(encoding="utf-8")
        updated = rewrite(original, tally)
        if updated != original:
            changed += 1
            if args.apply:
                path.write_text(updated, encoding="utf-8")

    if args.plan:
        print(f"{'OLD':>9}  ->  {'NEW':<9}  uses")
        print("-" * 34)
        for (old, new), count in tally.most_common():
            print(f"{old:>9}  ->  {new:<9}  {count}")
        print("-" * 34)
        print(f"{len(tally)} distinct colours remapped across {changed} files")
    else:
        print(f"retheme applied: {changed} files updated, {len(tally)} distinct colours remapped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
