#!/usr/bin/env python3
"""Generate App Store marketing screenshots for Repwise."""

import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
BG = (11, 15, 20)
GREEN = (74, 222, 128)
WHITE = (255, 255, 255)
GRAY = (156, 163, 175)
DARK2 = (22, 28, 36)
DARK3 = (30, 38, 48)
DARK4 = (38, 48, 60)

SIZES = [("6.7", 1290, 2796), ("6.5", 1284, 2778), ("5.5", 1242, 2208)]
SCREENS = [
    ("01_track", "Track Every Rep", "Log sets, reps & weight with one tap"),
    ("02_nutrition", "AI-Powered Nutrition", "Smart macros that adapt to your goals"),
    ("03_recovery", "Smart Recovery", "HRV, sleep & readiness in one score"),
    ("04_analytics", "Progress Analytics", "Visualize your strength gains over time"),
    ("05_social", "Social & Compete", "Challenge friends & climb leaderboards"),
]

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial Narrow.ttf"


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)
    except Exception:
        return ImageFont.load_default()


def draw_phone_frame(draw, cx, top, pw, ph):
    r = pw // 12
    x0, y0, x1, y1 = cx - pw // 2, top, cx + pw // 2, top + ph
    # Solid frame with subtle border
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=DARK2, outline=(45, 55, 65), width=4)
    # Notch
    nw, nh = pw // 3, ph // 45
    draw.rounded_rectangle(
        [cx - nw // 2, y0 + 10, cx + nw // 2, y0 + 10 + nh], radius=nh // 2, fill=BG
    )
    # Home indicator
    hw = pw // 4
    draw.rounded_rectangle(
        [cx - hw // 2, y1 - int(ph * 0.03), cx + hw // 2, y1 - int(ph * 0.02)],
        radius=4,
        fill=(60, 70, 80),
    )
    return x0, y0, x1, y1


def card(draw, x0, y0, x1, y1, s):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=int(s * 14), fill=DARK3)


def generate():
    from screens import DRAW_FNS

    for size_label, w, h in SIZES:
        s = w / 1290
        for i, (slug, headline, subtitle) in enumerate(SCREENS):
            img = Image.new("RGB", (w, h), BG)
            draw = ImageDraw.Draw(img)
            # Headline
            hf = font(int(s * 62), True)
            sf = font(int(s * 30))
            bb = draw.textbbox((0, 0), headline, font=hf)
            draw.text(((w - bb[2] + bb[0]) // 2, int(h * 0.05)), headline, fill=WHITE, font=hf)
            bb2 = draw.textbbox((0, 0), subtitle, font=sf)
            draw.text(
                ((w - bb2[2] + bb2[0]) // 2, int(h * 0.05) + int(s * 78)),
                subtitle,
                fill=GRAY,
                font=sf,
            )
            # Phone frame — larger, higher
            pw, ph = int(w * 0.82), int(h * 0.72)
            phone_top = int(h * 0.17)
            fx, fy, fx2, fy2 = draw_phone_frame(draw, w // 2, phone_top, pw, ph)
            # Screen content
            content_pad = int(pw * 0.07)
            cx0 = fx + content_pad
            cy0 = fy + int(ph * 0.06)
            cw = pw - 2 * content_pad
            ch = int(ph * 0.88)
            DRAW_FNS[i](draw, cx0, cy0, cw, ch, s)
            # Bottom accent
            draw.rounded_rectangle(
                [int(w * 0.3), h - int(s * 28), int(w * 0.7), h - int(s * 22)], radius=3, fill=GREEN
            )
            fname = f"{size_label}_{slug}.png"
            img.save(os.path.join(OUT, fname), "PNG")
            print(f"✓ {fname} ({w}x{h})")


if __name__ == "__main__":
    generate()
    print(f"\nDone! {len(SIZES) * len(SCREENS)} screenshots in {OUT}")
