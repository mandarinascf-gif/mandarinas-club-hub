from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 64
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "flags"


def new_flag(color: str = "#ffffff") -> Image.Image:
    return Image.new("RGBA", (SIZE, SIZE), color)


def horizontal_flag(colors: list[str], ratios: list[int] | None = None) -> Image.Image:
    img = new_flag(colors[0])
    draw = ImageDraw.Draw(img)
    weights = ratios or [1] * len(colors)
    total = sum(weights)
    top = 0
    for index, color in enumerate(colors):
      height = SIZE if index == len(colors) - 1 else round(SIZE * weights[index] / total)
      draw.rectangle((0, top, SIZE, min(SIZE, top + height)), fill=color)
      top += height
    return img


def vertical_flag(colors: list[str], ratios: list[int] | None = None) -> Image.Image:
    img = new_flag(colors[0])
    draw = ImageDraw.Draw(img)
    weights = ratios or [1] * len(colors)
    total = sum(weights)
    left = 0
    for index, color in enumerate(colors):
      width = SIZE if index == len(colors) - 1 else round(SIZE * weights[index] / total)
      draw.rectangle((left, 0, min(SIZE, left + width), SIZE), fill=color)
      left += width
    return img


def star_points(cx: float, cy: float, outer: float, inner: float, points: int = 5, rotation: float = -90.0):
    coords = []
    start = math.radians(rotation)
    step = math.pi / points
    for index in range(points * 2):
        radius = outer if index % 2 == 0 else inner
        angle = start + index * step
        coords.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    return coords


def draw_star(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    outer: float,
    inner: float,
    fill: str,
    points: int = 5,
    rotation: float = -90.0,
) -> None:
    draw.polygon(star_points(cx, cy, outer, inner, points, rotation), fill=fill)


def draw_regular_polygon(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
    sides: int,
    fill: str,
    rotation: float = -90.0,
) -> None:
    coords = []
    start = math.radians(rotation)
    for index in range(sides):
        angle = start + (2 * math.pi * index) / sides
        coords.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(coords, fill=fill)


def paste_union_jack(base: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    width = x1 - x0
    height = y1 - y0
    union = Image.new("RGBA", (width, height), "#1f4da1")
    draw = ImageDraw.Draw(union)
    draw.line((0, 0, width, height), fill="#ffffff", width=max(4, width // 5))
    draw.line((0, height, width, 0), fill="#ffffff", width=max(4, width // 5))
    draw.line((0, 0, width, height), fill="#c8102e", width=max(2, width // 9))
    draw.line((0, height, width, 0), fill="#c8102e", width=max(2, width // 9))
    draw.rectangle((width * 0.42, 0, width * 0.58, height), fill="#ffffff")
    draw.rectangle((0, height * 0.42, width, height * 0.58), fill="#ffffff")
    draw.rectangle((width * 0.46, 0, width * 0.54, height), fill="#c8102e")
    draw.rectangle((0, height * 0.46, width, height * 0.54), fill="#c8102e")
    base.alpha_composite(union, dest=(x0, y0))


def save(code: str, image: Image.Image) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    image.save(OUT_DIR / f"{code.lower()}.png")


def flag_ar() -> Image.Image:
    img = horizontal_flag(["#75aadb", "#ffffff", "#75aadb"])
    draw = ImageDraw.Draw(img)
    draw.ellipse((26, 26, 38, 38), fill="#f4c542")
    return img


def flag_au() -> Image.Image:
    img = new_flag("#012169")
    paste_union_jack(img, (0, 0, 32, 32))
    draw = ImageDraw.Draw(img)
    draw_star(draw, 18, 46, 8, 3.5, "#ffffff", points=7)
    for cx, cy in [(46, 18), (55, 30), (47, 42), (57, 50)]:
        draw_star(draw, cx, cy, 4, 1.8, "#ffffff", points=7)
    return img


def flag_be() -> Image.Image:
    return vertical_flag(["#000000", "#fdda24", "#ef3340"])


def flag_bo() -> Image.Image:
    return horizontal_flag(["#d52b1e", "#fcd116", "#007934"])


def flag_br() -> Image.Image:
    img = new_flag("#009c3b")
    draw = ImageDraw.Draw(img)
    draw.polygon([(32, 8), (56, 32), (32, 56), (8, 32)], fill="#ffdf00")
    draw.ellipse((18, 18, 46, 46), fill="#002776")
    draw.arc((14, 23, 50, 41), start=200, end=340, fill="#ffffff", width=3)
    return img


def flag_ca() -> Image.Image:
    img = vertical_flag(["#d52b1e", "#ffffff", "#d52b1e"], ratios=[1, 2, 1])
    draw = ImageDraw.Draw(img)
    draw_star(draw, 32, 32, 10, 4, "#d52b1e", points=8)
    return img


def flag_cl() -> Image.Image:
    img = new_flag("#d52b1e")
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, SIZE, SIZE // 2), fill="#ffffff")
    draw.rectangle((0, 0, 28, 28), fill="#0039a6")
    draw_star(draw, 14, 14, 7, 3, "#ffffff")
    return img


def flag_cn() -> Image.Image:
    img = new_flag("#de2910")
    draw = ImageDraw.Draw(img)
    draw_star(draw, 16, 16, 8, 3.5, "#ffde00")
    for cx, cy, rotation in [(26, 8, -45), (31, 15, -20), (31, 25, 10), (25, 32, 35)]:
        draw_star(draw, cx, cy, 3, 1.25, "#ffde00", rotation=rotation)
    return img


def flag_co() -> Image.Image:
    return horizontal_flag(["#fcd116", "#003893", "#ce1126"], ratios=[2, 1, 1])


def flag_cr() -> Image.Image:
    return horizontal_flag(["#002b7f", "#ffffff", "#ce1126", "#ffffff", "#002b7f"], ratios=[1, 1, 2, 1, 1])


def flag_hr() -> Image.Image:
    return horizontal_flag(["#ff0000", "#ffffff", "#171796"])


def flag_cu() -> Image.Image:
    img = horizontal_flag(["#002a8f", "#ffffff", "#002a8f", "#ffffff", "#002a8f"])
    draw = ImageDraw.Draw(img)
    draw.polygon([(0, 0), (28, 32), (0, 64)], fill="#cf142b")
    draw_star(draw, 10, 32, 7, 3, "#ffffff")
    return img


def flag_do() -> Image.Image:
    img = new_flag("#ffffff")
    draw = ImageDraw.Draw(img)
    cross = 10
    draw.rectangle((0, 0, 27, 27), fill="#002d62")
    draw.rectangle((37, 0, 64, 27), fill="#ce1126")
    draw.rectangle((0, 37, 27, 64), fill="#ce1126")
    draw.rectangle((37, 37, 64, 64), fill="#002d62")
    draw.rectangle((27, 0, 37, 64), fill="#ffffff")
    draw.rectangle((0, 27, 64, 37), fill="#ffffff")
    return img


def flag_ec() -> Image.Image:
    return flag_co()


def flag_sv() -> Image.Image:
    img = horizontal_flag(["#0047ab", "#ffffff", "#0047ab"])
    draw = ImageDraw.Draw(img)
    draw.ellipse((28, 28, 36, 36), fill="#d4af37")
    return img


def flag_gb() -> Image.Image:
    img = new_flag("#012169")
    paste_union_jack(img, (0, 0, SIZE, SIZE))
    return img


def flag_fr() -> Image.Image:
    return vertical_flag(["#0055a4", "#ffffff", "#ef4135"])


def flag_de() -> Image.Image:
    return horizontal_flag(["#000000", "#dd0000", "#ffce00"])


def flag_gh() -> Image.Image:
    img = horizontal_flag(["#ce1126", "#fcd116", "#006b3f"])
    draw = ImageDraw.Draw(img)
    draw_star(draw, 32, 32, 7, 3, "#000000")
    return img


def flag_gt() -> Image.Image:
    img = vertical_flag(["#4997d0", "#ffffff", "#4997d0"])
    draw = ImageDraw.Draw(img)
    draw.ellipse((28, 28, 36, 36), fill="#d4af37")
    return img


def flag_hn() -> Image.Image:
    img = horizontal_flag(["#0073cf", "#ffffff", "#0073cf"])
    draw = ImageDraw.Draw(img)
    for cx, cy in [(24, 28), (32, 24), (40, 28), (28, 36), (36, 36)]:
        draw.ellipse((cx - 1, cy - 1, cx + 1, cy + 1), fill="#0073cf")
    return img


def flag_in() -> Image.Image:
    img = horizontal_flag(["#ff9933", "#ffffff", "#138808"])
    draw = ImageDraw.Draw(img)
    draw.ellipse((24, 24, 40, 40), outline="#000088", width=2)
    return img


def flag_ie() -> Image.Image:
    return vertical_flag(["#169b62", "#ffffff", "#ff883e"])


def flag_it() -> Image.Image:
    return vertical_flag(["#009246", "#ffffff", "#ce2b37"])


def flag_jp() -> Image.Image:
    img = new_flag("#ffffff")
    draw = ImageDraw.Draw(img)
    draw.ellipse((18, 18, 46, 46), fill="#bc002d")
    return img


def flag_kr() -> Image.Image:
    img = new_flag("#ffffff")
    draw = ImageDraw.Draw(img)
    draw.pieslice((20, 20, 44, 44), start=0, end=180, fill="#c60c30")
    draw.pieslice((20, 20, 44, 44), start=180, end=360, fill="#003478")
    draw.ellipse((24, 20, 36, 32), fill="#003478")
    draw.ellipse((28, 32, 40, 44), fill="#c60c30")
    for x0, y0, x1, y1 in [(10, 16, 18, 18), (12, 21, 20, 23), (10, 26, 18, 28), (46, 16, 54, 18), (44, 21, 52, 23), (46, 26, 54, 28), (10, 40, 18, 42), (12, 45, 20, 47), (10, 50, 18, 52), (46, 40, 54, 42), (44, 45, 52, 47), (46, 50, 54, 52)]:
        draw.rectangle((x0, y0, x1, y1), fill="#000000")
    return img


def flag_mx() -> Image.Image:
    img = vertical_flag(["#006847", "#ffffff", "#ce1126"])
    draw = ImageDraw.Draw(img)
    draw.ellipse((28, 28, 36, 36), fill="#8c6239")
    draw.arc((26, 26, 38, 38), start=200, end=340, fill="#006847", width=2)
    return img


def flag_ma() -> Image.Image:
    img = new_flag("#c1272d")
    draw = ImageDraw.Draw(img)
    draw.line(star_points(32, 32, 12, 12, points=5, rotation=-90.0) + [star_points(32, 32, 12, 12, points=5, rotation=-90.0)[0]], fill="#006233", width=2)
    return img


def flag_nl() -> Image.Image:
    return horizontal_flag(["#ae1c28", "#ffffff", "#21468b"])


def flag_ni() -> Image.Image:
    return horizontal_flag(["#0067c6", "#ffffff", "#0067c6"])


def flag_py() -> Image.Image:
    return horizontal_flag(["#d52b1e", "#ffffff", "#0038a8"])


def flag_pe() -> Image.Image:
    return vertical_flag(["#d91023", "#ffffff", "#d91023"])


def flag_pt() -> Image.Image:
    img = vertical_flag(["#006600", "#ff0000"], ratios=[2, 3])
    draw = ImageDraw.Draw(img)
    draw.ellipse((22, 22, 42, 42), outline="#ffcc33", width=3)
    return img


def flag_sn() -> Image.Image:
    img = vertical_flag(["#00853f", "#fdef42", "#e31b23"])
    draw = ImageDraw.Draw(img)
    draw_star(draw, 32, 32, 7, 3, "#00853f")
    return img


def flag_es() -> Image.Image:
    return horizontal_flag(["#aa151b", "#f1bf00", "#aa151b"], ratios=[1, 2, 1])


def flag_us() -> Image.Image:
    img = new_flag("#ffffff")
    draw = ImageDraw.Draw(img)
    stripe_height = SIZE / 13
    for index in range(13):
        color = "#b22234" if index % 2 == 0 else "#ffffff"
        top = round(index * stripe_height)
        bottom = round((index + 1) * stripe_height)
        draw.rectangle((0, top, SIZE, bottom), fill=color)
    draw.rectangle((0, 0, 30, 34), fill="#3c3b6e")
    for row in range(5):
        for col in range(6):
            x = 4 + col * 4.2 + (2.1 if row % 2 else 0)
            y = 4 + row * 5.8
            draw.ellipse((x, y, x + 1.5, y + 1.5), fill="#ffffff")
    return img


def flag_uy() -> Image.Image:
    img = new_flag("#ffffff")
    draw = ImageDraw.Draw(img)
    stripe_height = SIZE / 9
    for index in range(1, 9, 2):
        top = round(index * stripe_height)
        bottom = round((index + 1) * stripe_height)
        draw.rectangle((0, top, SIZE, bottom), fill="#0038a8")
    draw.ellipse((8, 8, 24, 24), fill="#f6c700")
    return img


def flag_ve() -> Image.Image:
    img = horizontal_flag(["#ffcc00", "#0033a0", "#cf142b"])
    draw = ImageDraw.Draw(img)
    for cx in [20, 24, 28, 32, 36, 40, 44, 48]:
        draw.ellipse((cx - 1, 30, cx + 1, 32), fill="#ffffff")
    return img


FLAGS = {
    "AR": flag_ar,
    "AU": flag_au,
    "BE": flag_be,
    "BO": flag_bo,
    "BR": flag_br,
    "CA": flag_ca,
    "CL": flag_cl,
    "CN": flag_cn,
    "CO": flag_co,
    "CR": flag_cr,
    "CU": flag_cu,
    "DE": flag_de,
    "DO": flag_do,
    "EC": flag_ec,
    "ES": flag_es,
    "FR": flag_fr,
    "GB": flag_gb,
    "GH": flag_gh,
    "GT": flag_gt,
    "HN": flag_hn,
    "HR": flag_hr,
    "IE": flag_ie,
    "IN": flag_in,
    "IT": flag_it,
    "JP": flag_jp,
    "KR": flag_kr,
    "MA": flag_ma,
    "MX": flag_mx,
    "NI": flag_ni,
    "NL": flag_nl,
    "PE": flag_pe,
    "PT": flag_pt,
    "PY": flag_py,
    "SN": flag_sn,
    "SV": flag_sv,
    "US": flag_us,
    "UY": flag_uy,
    "VE": flag_ve,
}


def main() -> None:
    for code, builder in sorted(FLAGS.items()):
        save(code, builder())


if __name__ == "__main__":
    main()
