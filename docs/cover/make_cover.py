#!/usr/bin/env python3
"""Render Maestro cover / hero images from the shared design tokens.

Colors come from design/tokens.json and the M from design/mark.svg, so the
covers follow the design system when it changes. Each concept is written as an
SVG and rendered to PNG with rsvg-convert (brew install librsvg).

    python3 docs/cover/make_cover.py                       # all concepts, dark
    python3 docs/cover/make_cover.py stage --theme light   # one concept
    python3 docs/cover/make_cover.py --width 1200 --height 800
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "out"
MAX_BYTES = 10 * 1024 * 1024

TAGLINE = "Live key, beat and cues from DJ to musician."
TRACK = ("Deck 1 · Heart Like Mine", "Sam Feldt")
PREVIEW = ("Preview · Deck 2 · Golden Hour — Nova Lane", "F♯ minor · 122 BPM · Paused")
KEY, MODE, CONCERT = "C♯", "minor", "Concert E minor · E♭ alto sax"
BPM = "124"

# Every concept is drawn on this canvas, then scaled to the requested size.
W, H = 1920, 1080
FONT = "Arial, 'Arial Unicode MS', Helvetica, sans-serif"  # fallback has ♯ and ♭


def load_design(theme):
    tokens = json.loads((ROOT / "design/tokens.json").read_text())
    mark = (ROOT / "design/mark.svg").read_text()
    path = re.search(r'\sd="([^"]+)"', mark).group(1)
    return tokens["themes"][theme], path


def text(x, y, s, size, fill, weight=400, anchor="start", spacing=0, opacity=1):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" '
            f'letter-spacing="{spacing}" opacity="{opacity}">{escape(s)}</text>')


def key_name(x, y, size, fill):
    """KEY in Arial Bold. Arial has no ♯, so draw a sharp of matching weight."""
    letter, sharp = KEY.rstrip("♯"), KEY.endswith("♯")
    out = text(x, y, letter, size, fill, 700)
    if sharp:
        u = size / 100
        sx = x + 76 * u  # Arial Bold capital advance is ~0.72 em
        lines = [(16, -74, 16, 6), (38, -80, 38, 0),       # stems
                 (4, -44, 52, -54), (2, -18, 50, -28)]     # rising bars
        out += "".join(
            f'<line x1="{sx + a * u:.1f}" y1="{y + b * u:.1f}" x2="{sx + c2 * u:.1f}" '
            f'y2="{y + d * u:.1f}" stroke="{fill}" stroke-width="{(8 if i < 2 else 11) * u:.1f}"/>'
            for i, (a, b, c2, d) in enumerate(lines))
    return out


def eyebrow(x, y, s, c, size=14, anchor="start"):
    return text(x, y, s, size, c["muted"], 700, anchor, size * 0.16)


def brand(x, y, c, mark, size=56, product=None):
    """Mark + MAESTRO lockup; y is the text baseline."""
    s = size / 20  # wordmark.svg draws a 20px label beside a 32px mark
    out = [f'<g transform="translate({x},{y - 25 * s}) scale({s})">'
           f'<path fill="{c["accent"]}" d="{mark}"/></g>',
           text(x + 42 * s, y, "MAESTRO", size, c["ink"], 700, spacing=size * 0.15)]
    if product:
        lx = x + 42 * s + size * 6.25
        out.append(text(lx, y, "/", size, c["muted"]))
        out.append(text(lx + size * 0.8, y, product, size * 0.55, c["muted"], 700,
                        spacing=size * 0.08))
    return "".join(out)


def waveform(x, y, w, h, c, bars=96, played=0.42, seed=7, gap=0.35):
    """Deterministic, music-shaped bars: quiet intro, build, drop."""
    import math
    import random
    rnd = random.Random(seed)
    step = w / bars
    bw = step * (1 - gap)
    mid = y + h / 2
    out = []
    for i in range(bars):
        t = i / bars
        env = 0.25 + 0.35 * t if t < 0.55 else (0.95 if t < 0.85 else 0.6)
        amp = env * (0.55 + 0.45 * abs(math.sin(i * 0.9))) * (0.75 + 0.25 * rnd.random())
        bh = max(4, h * min(amp, 1))
        fill = c["accent"] if t < played else c["line"]
        out.append(f'<rect x="{x + i * step:.1f}" y="{mid - bh / 2:.1f}" width="{bw:.1f}" '
                   f'height="{bh:.1f}" rx="{min(bw / 2, 3):.1f}" fill="{fill}"/>')
    px = x + w * played
    out.append(f'<rect x="{px - 1.5:.1f}" y="{y - 10}" width="3" height="{h + 20}" '
               f'rx="1.5" fill="{c["ink"]}"/>')
    return "".join(out)


def wave_strip(x, y, w, h, c, bpm=124, seed=3):
    """The app's live waveform (client/app.js drawWave): 8 s of 25 ms min/max
    windows, newest on the right, filled in the accent and faded in from the left.
    The audio is a drop arriving: vocal breakdown, snare-roll build, pause, drop."""
    import math
    import random
    rnd = random.Random(seed)
    windows, beat = 320, 60 / bpm
    bump = lambda t, at, width: math.exp(-((t - at) / width) ** 2)

    def level(t):
        if t < 3.0:  # breakdown: a pad under sung phrases
            words = [(0.3, 0.32), (0.62, 0.45), (0.9, 0.3), (1.45, 0.55), (1.8, 0.4),
                     (2.15, 0.6), (2.5, 0.38), (2.8, 0.5)]
            return 0.1 + 0.05 * math.sin(t * 2) + sum(a * bump(t, at, 0.11) for at, a in words)
        if t < 5.9:  # build: the snare roll doubles in speed as the riser climbs
            u = (t - 3.0) / 2.9
            gap = beat / 2 ** min(3, int(u * 4))
            hit = math.exp(-((t - 3.0) % gap) / gap * 5)
            return 0.12 + 0.3 * u + (0.25 + 0.55 * u) * hit
        if t < 6.15:  # the pause before the drop
            return 0.03
        phase = ((t - 6.15) % beat) / beat  # drop: kick, bass and hats at full level
        return 0.5 + 0.45 * math.exp(-phase * 10) + 0.1 * bump(phase, 0.5, 0.05)

    mid = y + h / 2
    tops, bottoms = [], []
    for i in range(windows + 1):
        amp = min(0.97, level(i * 0.025) * (0.92 + 0.08 * rnd.random()))
        px = x + w * i / windows
        tops.append(f"{px:.1f},{mid - amp * h / 2 * 0.95:.1f}")
        bottoms.append(f"{px:.1f},{mid + amp * (0.88 + 0.12 * rnd.random()) * h / 2 * 0.95:.1f}")
    fade = (f'<linearGradient id="wavefade" gradientUnits="userSpaceOnUse" x1="{x}" y1="0" '
            f'x2="{x + w * 0.2}" y2="0"><stop offset="0" stop-color="{c["accent"]}" stop-opacity="0"/>'
            f'<stop offset="1" stop-color="{c["accent"]}"/></linearGradient>')
    return fade + f'<polygon points="{" ".join(tops + bottoms[::-1])}" fill="url(#wavefade)"/>'


def beat_dots(x, y, c, lit=3, r=7, gap=26):
    return "".join(f'<circle cx="{x + i * gap}" cy="{y}" r="{r}" '
                   f'fill="{c["accent"] if i == lit else c["raised"]}"/>' for i in range(4))


def phone(x, y, c, mark, cue="Play", scale=1.0):
    """The musician web app on a phone, 470 x 940 before scaling."""
    w, h, p = 470, 940, 34
    cue_color = {"Stop": c["cueRed"], "Ready": c["cueAmber"], "Play": c["cueGreen"]}[cue]
    rule = lambda yy: (f'<rect x="{p}" y="{yy}" width="{w - 2 * p}" height="1" '
                       f'fill="{c["line"]}" opacity="0.45"/>')
    body = [
        f'<rect x="-10" y="-10" width="{w + 20}" height="{h + 20}" rx="66" fill="#000" opacity="0.55"/>',
        f'<rect width="{w}" height="{h}" rx="58" fill="{c["bg"]}" stroke="{c["raised"]}" stroke-width="3"/>',
        f'<rect x="{w / 2 - 60}" y="18" width="120" height="30" rx="15" fill="#000"/>',
        brand(p, 104, c, mark, size=18, product="MUSICIAN"),
        rule(132),
        eyebrow(p, 170, "CUE", c, 13),
        text(p, 268, cue, 104, cue_color, 700),
        rule(306),
        eyebrow(p, 344, "AUDIO", c, 13),
        text(p, 384, TRACK[0], 25, c["ink"], 700),
        text(p, 414, TRACK[1], 18, c["muted"]),
        wave_strip(p, 438, w - 2 * p, 84, c),
        f'<rect x="{p}" y="548" width="{w - 2 * p}" height="6" rx="3" fill="{c["raised"]}"/>',
        f'<rect x="{p}" y="548" width="{(w - 2 * p) * 0.46:.0f}" height="6" rx="3" fill="{c["accent"]}"/>',
        text(p, 582, "1:24", 16, c["ink"]) + text(p + 40, 582, "/", 16, c["muted"])
        + text(p + 56, 582, "3:02", 16, c["ink"]),
        text(w - p, 582, "Playing", 16, c["muted"], anchor="end"),
        text(p, 624, PREVIEW[0], 15, c["muted"]),
        text(p, 648, PREVIEW[1], 15, c["muted"]),
        rule(676),
        eyebrow(p, 714, "MUSIC", c, 13),
        eyebrow(p, 750, "KEY", c, 12),
        key_name(p, 848, 112, c["ink"]),
        text(p + 164, 848, MODE, 38, c["ink"]),
        eyebrow(w - p - 104, 750, "BPM", c, 12),
        text(w - p - 104, 812, BPM, 56, c["ink"], 700),
        beat_dots(w - p - 97, 846, c),
    ]
    return f'<g transform="translate({x},{y}) scale({scale})">{"".join(body)}</g>'


def plugin(x, y, c, mark, cue="Play"):
    """The Maestro Cue plugin editor in djay, 640 x 470."""
    w, h, p = 640, 470, 32
    colors = {"Stop": c["cueRed"], "Ready": c["cueAmber"], "Play": c["cueGreen"]}
    fills = {"Stop": c["cueRedFill"], "Ready": c["cueAmberFill"], "Play": c["cueGreenFill"]}
    body = [
        f'<rect x="-8" y="-8" width="{w + 16}" height="{h + 16}" rx="24" fill="#000" opacity="0.5"/>',
        f'<rect width="{w}" height="{h}" rx="16" fill="{c["surface"]}" stroke="{c["raised"]}" stroke-width="2"/>',
        brand(p, 62, c, mark, size=20, product="CUE"),
        f'<rect x="{p}" y="92" width="{w - 2 * p}" height="1" fill="{c["line"]}" opacity="0.45"/>',
        f'<rect x="{p}" y="120" width="{w - 2 * p}" height="200" rx="16" fill="{c["raised"]}" '
        f'stroke="{colors[cue]}" stroke-width="3"/>',
        f'<circle cx="{p + 92}" cy="220" r="46" fill="{fills[cue]}" filter="url(#glow)"/>',
        f'<circle cx="{p + 92}" cy="220" r="46" fill="{fills[cue]}"/>',
        text(p + 170, 244, cue, 72, colors[cue], 700),
        text(w - p - 28, 244, "SPACE", 15, c["muted"], 700, "end", 2),
    ]
    sx = p
    for state in ("Stop", "Ready", "Play"):
        on = state == cue
        body.append(f'<rect x="{sx}" y="346" width="180" height="44" rx="8" '
                    f'fill="{c["bg"] if not on else c["raised"]}" stroke="{colors[state]}" '
                    f'stroke-opacity="{1 if on else 0.4}" stroke-width="2"/>')
        body.append(text(sx + 90, 375, state.upper(), 16, colors[state], 700, "middle", 2,
                         1 if on else 0.6))
        sx += 196
    body.append(eyebrow(p, 432, "SEND TO", c, 13))
    body.append(text(p + 100, 432, "127.0.0.1 : 9000", 17, c["ink"]))
    return f'<g transform="translate({x},{y})">{"".join(body)}</g>'


def backdrop(c, glow_x=0.72, glow_y=0.5):
    return (f'<rect width="{W}" height="{H}" fill="{c["bg"]}"/>'
            f'<radialGradient id="halo" cx="{glow_x}" cy="{glow_y}" r="0.55">'
            f'<stop offset="0" stop-color="{c["accent"]}" stop-opacity="0.22"/>'
            f'<stop offset="1" stop-color="{c["accent"]}" stop-opacity="0"/></radialGradient>'
            f'<rect width="{W}" height="{H}" fill="url(#halo)"/>')


# --- Concepts -------------------------------------------------------------

def stage(c, mark):
    """Headline on the left, the musician app on a phone on the right."""
    return [
        backdrop(c, 0.76, 0.5),
        brand(150, 250, c, mark, size=60),
        text(150, 470, "Live key, beat and cues", 82, c["ink"], 700),
        text(150, 570, "from DJ to musician.", 82, c["accent"], 700),
        text(150, 680, "A djay Pro plugin and a musician companion app", 32, c["muted"]),
        text(150, 726, "for DJs who perform with live players.", 32, c["muted"]),
        phone(1290, 70, c, mark),
    ]


def traffic(c, mark):
    """Stop / Ready / Play lights, Play lit."""
    lights = []
    states = [("STOP", "cueRed", "cueRedFill"), ("READY", "cueAmber", "cueAmberFill"),
              ("PLAY", "cueGreen", "cueGreenFill")]
    for i, (label, tc, fc) in enumerate(states):
        cx, cy, r = 600 + i * 360, 470, 140
        on = label == "PLAY"
        if on:
            lights.append(f'<circle cx="{cx}" cy="{cy}" r="{r + 30}" fill="{c[fc]}" '
                          f'opacity="0.55" filter="url(#bigglow)"/>')
        lights.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c[fc]}" '
                      f'fill-opacity="{1 if on else 0.16}" stroke="{c[fc]}" '
                      f'stroke-opacity="{1 if on else 0.55}" stroke-width="4"/>')
        lights.append(text(cx, cy + r + 90, label, 48, c[tc], 700, "middle", 6,
                           1 if on else 0.55))
    return [
        backdrop(c, 0.5, 0.42),
        f'<rect x="400" y="290" width="1120" height="360" rx="180" fill="{c["surface"]}" '
        f'stroke="{c["raised"]}" stroke-width="3"/>',
        *lights,
        brand(120, 140, c, mark, size=44),
        text(W / 2, 940, TAGLINE, 58, c["ink"], 700, "middle"),
    ]


def key(c, mark):
    """The transposed key, huge, over a scrolling waveform."""
    return [
        backdrop(c, 0.3, 0.45),
        brand(120, 140, c, mark, size=44),
        f'<rect x="1380" y="88" width="420" height="72" rx="36" fill="{c["surface"]}" '
        f'stroke="{c["cueAmber"]}" stroke-width="3"/>',
        f'<circle cx="1424" cy="124" r="14" fill="{c["cueAmberFill"]}"/>',
        text(1456, 136, "READY", 32, c["cueAmber"], 700, spacing=2),
        text(1772, 134, "NEXT · PLAY", 18, c["muted"], 700, "end", 2),
        eyebrow(120, 300, "YOUR KEY", c, 22),
        key_name(110, 590, 330, c["ink"]),
        text(590, 590, MODE, 110, c["accent"], 400),
        text(120, 660, CONCERT, 30, c["muted"]),
        eyebrow(1500, 300, "BPM", c, 22),
        text(1500, 470, BPM, 170, c["ink"], 700),
        beat_dots(1514, 540, c, r=13, gap=46),
        waveform(120, 740, W - 240, 170, c, bars=120, played=0.38),
        text(W / 2, 1010, TAGLINE, 36, c["muted"], 400, "middle"),
    ]


def booth(c, mark):
    """DJ booth to stage: the plugin sends a cue to the musician's phone."""
    link = (f'<path d="M 800 705 L 1230 705" fill="none" '
            f'stroke="{c["accent"]}" stroke-width="4" stroke-dasharray="4 14" stroke-linecap="round"/>'
            f'<path d="M 1224 687 L 1252 705 L 1224 723 Z" fill="{c["accent"]}"/>'
            f'<rect x="955" y="663" width="120" height="32" rx="16" fill="{c["raised"]}"/>'
            + text(1015, 686, "OSC", 16, c["accent"], 700, "middle", 3))
    return [
        backdrop(c, 0.5, 0.6),
        brand(120, 140, c, mark, size=44),
        text(120, 250, TAGLINE, 58, c["ink"], 700),
        eyebrow(130, 440, "IN THE DJ BOOTH · djay Pro", c, 18),
        plugin(130, 470, c, mark),
        link,
        eyebrow(1290, 340, "ON STAGE · MUSICIAN", c, 18),
        phone(1290, 370, c, mark, scale=0.7),
    ]


CONCEPTS = {"stage": stage, "traffic": traffic, "key": key, "booth": booth}


def build_svg(concept, theme, width, height):
    c, mark = load_design(theme)
    body = "".join(CONCEPTS[concept](c, mark))
    # Cover the requested aspect ratio without stretching the design.
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<defs><filter id="glow" x="-1" y="-1" width="3" height="3">'
            f'<feGaussianBlur stdDeviation="18"/></filter>'
            f'<filter id="bigglow" x="-1" y="-1" width="3" height="3">'
            f'<feGaussianBlur stdDeviation="40"/></filter></defs>'
            f'<rect x="-2000" y="-2000" width="6000" height="6000" fill="{c["bg"]}"/>'
            f'{body}</svg>')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("concepts", nargs="*", choices=[[], *CONCEPTS], default=[],
                    help="concepts to render (default: all)")
    ap.add_argument("--theme", choices=["dark", "light"], default="dark")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    args = ap.parse_args()

    rsvg = shutil.which("rsvg-convert")
    if not rsvg:
        sys.exit("rsvg-convert not found: brew install librsvg")
    OUT.mkdir(exist_ok=True)
    for name in args.concepts or CONCEPTS:
        stem = OUT / f"maestro-cover-{name}-{args.theme}"
        svg = stem.with_suffix(".svg")
        png = stem.with_suffix(".png")
        svg.write_text(build_svg(name, args.theme, args.width, args.height))
        subprocess.run([rsvg, "-o", str(png), str(svg)], check=True)
        size = png.stat().st_size
        flag = "  ** over 10 MB **" if size > MAX_BYTES else ""
        print(f"{png.relative_to(ROOT)}  {args.width}x{args.height}  {size / 1024:.0f} KB{flag}")


if __name__ == "__main__":
    main()
