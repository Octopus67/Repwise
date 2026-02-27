"""Generate Repwise app icons using Pillow.

Creates:
  - app/assets/icon.png (1024x1024, full icon with background)
  - app/assets/adaptive-icon.png (1024x1024, foreground only with transparent padding)

Design: Bold geometric "R" in accent purple (#6C63FF) on dark background (#0B0F14),
with a subtle rounded-square container and a small upward-trending graph line
integrated into the R's leg to hint at "progress tracking".
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Brand colors
BG_COLOR = (11, 15, 20)        # #0B0F14
ACCENT = (108, 99, 255)        # #6C63FF
ACCENT_LIGHT = (140, 133, 255) # lighter accent for gradient effect
WHITE = (255, 255, 255)

SIZE = 1024
CENTER = SIZE // 2


def rounded_rectangle(draw, xy, radius, fill):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    draw.rectangle([x0 + radius, y0, x1 - radius, y1], fill=fill)
    draw.rectangle([x0, y0 + radius, x1, y1 - radius], fill=fill)
    draw.pieslice([x0, y0, x0 + 2 * radius, y0 + 2 * radius], 180, 270, fill=fill)
    draw.pieslice([x1 - 2 * radius, y0, x1, y0 + 2 * radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2 * radius, x0 + 2 * radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2 * radius, y1 - 2 * radius, x1, y1], 0, 90, fill=fill)


def draw_bold_R(draw, x_offset, y_offset, scale, color, thickness):
    """Draw a bold geometric R using shapes."""
    t = thickness
    h = int(600 * scale)
    w = int(380 * scale)
    
    x = x_offset
    y = y_offset
    
    # Vertical stem (left side of R)
    draw.rectangle([x, y, x + t, y + h], fill=color)
    
    # Top horizontal bar
    draw.rectangle([x, y, x + w - int(80 * scale), y + t], fill=color)
    
    # Middle horizontal bar
    mid_y = y + int(280 * scale)
    draw.rectangle([x, mid_y, x + w - int(80 * scale), mid_y + t], fill=color)
    
    # Right curve of the bowl (top half) - approximated with a vertical bar + rounded end
    bowl_x = x + w - int(80 * scale)
    draw.rectangle([bowl_x, y, bowl_x + t, mid_y + t], fill=color)
    
    # Round the top-right corner of the bowl
    r = int(80 * scale)
    draw.pieslice([bowl_x - r + t, y, bowl_x + t + r, y + 2 * r], 270, 360, fill=color)
    
    # Round the bottom-right corner of the bowl  
    draw.pieslice([bowl_x - r + t, mid_y + t - 2 * r, bowl_x + t + r, mid_y + t], 0, 90, fill=color)
    
    # Diagonal leg of R (from middle bar going down-right)
    leg_start_x = x + int(160 * scale)
    leg_start_y = mid_y + t
    leg_end_x = x + w + int(40 * scale)
    leg_end_y = y + h
    
    # Draw thick diagonal line
    for i in range(-t // 2, t // 2 + 1):
        draw.line([(leg_start_x + i, leg_start_y), (leg_end_x + i, leg_end_y)], fill=color, width=3)


def create_icon():
    """Create the main app icon (1024x1024 with background)."""
    img = Image.new('RGBA', (SIZE, SIZE), BG_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded square background container
    margin = 40
    rounded_rectangle(draw, (margin, margin, SIZE - margin, SIZE - margin), 180, (20, 25, 35))
    
    # Draw a subtle inner glow/border
    for i in range(3):
        offset = margin + 4 + i
        rounded_rectangle(draw, (offset, offset, SIZE - offset, SIZE - offset), 176, None)
    
    # Draw the R
    r_scale = 1.15
    r_x = int(CENTER - 220 * r_scale)
    r_y = int(CENTER - 300 * r_scale)
    draw_bold_R(draw, r_x, r_y, r_scale, ACCENT, int(75 * r_scale))
    
    # Add a small upward trend line at bottom right (subtle data/progress hint)
    trend_y_base = int(CENTER + 220)
    trend_x_start = int(CENTER + 80)
    points = [
        (trend_x_start, trend_y_base),
        (trend_x_start + 60, trend_y_base - 20),
        (trend_x_start + 120, trend_y_base - 10),
        (trend_x_start + 180, trend_y_base - 60),
        (trend_x_start + 240, trend_y_base - 100),
    ]
    draw.line(points, fill=ACCENT_LIGHT, width=8, joint='curve')
    
    # Small dot at the end of the trend line
    last = points[-1]
    draw.ellipse([last[0] - 10, last[1] - 10, last[0] + 10, last[1] + 10], fill=ACCENT_LIGHT)
    
    return img


def create_adaptive_icon():
    """Create the adaptive icon foreground (1024x1024, transparent background with padding)."""
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Android adaptive icons need ~30% safe zone padding
    # The foreground is 108dp rendered at 1024px, with 72dp visible (66%)
    # So we need to keep content within the center ~66% of the image
    padding = int(SIZE * 0.17)  # ~17% padding on each side
    
    # Draw the R centered with padding consideration
    r_scale = 0.95
    r_x = int(CENTER - 200 * r_scale)
    r_y = int(CENTER - 280 * r_scale)
    draw_bold_R(draw, r_x, r_y, r_scale, ACCENT, int(75 * r_scale))
    
    # Trend line (smaller, within safe zone)
    trend_y_base = int(CENTER + 190)
    trend_x_start = int(CENTER + 60)
    points = [
        (trend_x_start, trend_y_base),
        (trend_x_start + 50, trend_y_base - 15),
        (trend_x_start + 100, trend_y_base - 8),
        (trend_x_start + 150, trend_y_base - 50),
        (trend_x_start + 200, trend_y_base - 85),
    ]
    draw.line(points, fill=ACCENT_LIGHT, width=7, joint='curve')
    last = points[-1]
    draw.ellipse([last[0] - 8, last[1] - 8, last[0] + 8, last[1] + 8], fill=ACCENT_LIGHT)
    
    return img


if __name__ == '__main__':
    assets_dir = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    
    print("Generating icon.png...")
    icon = create_icon()
    icon_path = os.path.join(assets_dir, 'icon.png')
    icon.save(icon_path, 'PNG')
    print(f"  Saved: {icon_path}")
    
    print("Generating adaptive-icon.png...")
    adaptive = create_adaptive_icon()
    adaptive_path = os.path.join(assets_dir, 'adaptive-icon.png')
    adaptive.save(adaptive_path, 'PNG')
    print(f"  Saved: {adaptive_path}")
    
    print("Done!")
