#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "deliverables" / "guides"
PDF_PATH = OUTPUT_DIR / "mandarinas-core-flex-system-guide-en.pdf"

CREST_PATH = ROOT / "assets" / "images" / "brand" / "mandarinas-crest-clean.png"
CORE_TOKEN_PATH = ROOT / "assets" / "images" / "lineup" / "jersey-token-green-v4.png"
FLEX_TOKEN_PATH = ROOT / "assets" / "images" / "lineup" / "jersey-token-orange-v4.png"
SUB_TOKEN_PATH = ROOT / "assets" / "images" / "lineup" / "jersey-token-blue-v4.png"
WINNER_TOKEN_PATH = ROOT / "assets" / "images" / "lineup" / "jersey-token-magenta-v4.png"

PAGE_WIDTH, PAGE_HEIGHT = landscape(letter)
MARGIN = 28
GUTTER = 16
HEADER_HEIGHT = 96
FOOTER_HEIGHT = 20
PANEL_RADIUS = 18
PANEL_INSET = 16

BG = HexColor("#09131F")
HEADER_BG = HexColor("#102232")
HEADER_GLOW = HexColor("#173A33")
PANEL_BG = HexColor("#122131")
PANEL_BG_ALT = HexColor("#101D2C")
PANEL_BORDER = HexColor("#2C4A63")
TEXT = HexColor("#F4F8FB")
TEXT_MUTED = HexColor("#C6D5E2")
TEXT_SOFT = HexColor("#91A5B8")
CORE_COLOR = HexColor("#4AA26F")
FLEX_COLOR = HexColor("#F0A24C")
SUB_COLOR = HexColor("#5C83C6")
ACCENT = HexColor("#FFD08A")
GOLD = HexColor("#F6C75A")
SILVER = HexColor("#DCE6EF")
BRONZE = HexColor("#CE8B58")
RULE = HexColor("#264055")


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="HeaderTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=24,
            textColor=TEXT,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="HeaderBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=13.2,
            textColor=TEXT_MUTED,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PanelTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13.2,
            leading=15.2,
            textColor=TEXT,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PanelBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12.4,
            textColor=TEXT_MUTED,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PanelLabel",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=9.5,
            textColor=TEXT_SOFT,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Chip",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=8.2,
            leading=10,
            textColor=TEXT,
            alignment=TA_LEFT,
        )
    )
    return styles


STYLES = build_styles()

def draw_paragraph(c: canvas.Canvas, text: str, style: ParagraphStyle, x: float, top: float, width: float):
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, 1000)
    paragraph.drawOn(c, x, top - height)
    return height


def draw_round_panel(c: canvas.Canvas, x: float, y: float, width: float, height: float, *, fill, stroke):
    c.saveState()
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1)
    c.roundRect(x, y, width, height, PANEL_RADIUS, fill=1, stroke=1)
    c.restoreState()


def draw_contain_image(
    c: canvas.Canvas,
    path: Path,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    alpha: float = 1.0,
):
    image = ImageReader(str(path))
    src_width, src_height = image.getSize()
    scale = min(width / src_width, height / src_height)
    draw_width = src_width * scale
    draw_height = src_height * scale
    draw_x = x + (width - draw_width) / 2
    draw_y = y + (height - draw_height) / 2

    c.saveState()
    if alpha < 1:
        c.setFillAlpha(alpha)
        c.setStrokeAlpha(alpha)
    c.drawImage(
        image,
        draw_x,
        draw_y,
        width=draw_width,
        height=draw_height,
        mask="auto",
        preserveAspectRatio=True,
    )
    c.restoreState()


def draw_chip(c: canvas.Canvas, x: float, y: float, text: str, fill):
    width = max(74, 12 + len(text) * 5.3)
    height = 18
    c.saveState()
    c.setFillColor(fill)
    c.roundRect(x, y, width, height, 9, fill=1, stroke=0)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 9, y + 5.1, text)
    c.restoreState()
    return width


def draw_note_box(c: canvas.Canvas, x: float, y: float, width: float, height: float, title: str, body: str):
    c.saveState()
    c.setFillColor(HexColor("#173043"))
    c.roundRect(x, y, width, height, 12, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 8.4)
    c.drawString(x + 10, y + height - 16, title)
    c.restoreState()
    draw_paragraph(c, body, STYLES["PanelBody"], x + 10, y + height - 22, width - 20)


def draw_token_row(c: canvas.Canvas, path: Path, x: float, y: float, count: int, size: float, gap: float):
    for index in range(count):
        draw_contain_image(c, path, x + index * (size + gap), y, size, size)


def draw_header(c: canvas.Canvas):
    x = MARGIN
    y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT
    width = PAGE_WIDTH - (MARGIN * 2)

    draw_round_panel(c, x, y, width, HEADER_HEIGHT, fill=HEADER_BG, stroke=PANEL_BORDER)

    c.saveState()
    c.setFillColor(HEADER_GLOW)
    c.circle(x + width - 54, y + HEADER_HEIGHT - 26, 34, fill=1, stroke=0)
    c.restoreState()

    draw_contain_image(c, CREST_PATH, x + width - 82, y + 14, 58, 58, alpha=0.96)

    title_x = x + 18
    title_top = y + HEADER_HEIGHT - 24
    draw_paragraph(
        c,
        "Mandarinas Core + Flex System",
        STYLES["HeaderTitle"],
        title_x,
        title_top,
        width - 130,
    )
    draw_paragraph(
        c,
        (
            "Simple guide for the new rotation system: weekly spots, Finals snake draft, "
            "Flex promotion chances, and how the app helps everyone follow it."
        ),
        STYLES["HeaderBody"],
        title_x,
        y + 48,
        width - 150,
    )

    chip_y = y + 12
    chip_x = title_x
    chip_x += draw_chip(c, chip_x, chip_y, "Core first", CORE_COLOR) + 8
    chip_x += draw_chip(c, chip_x, chip_y, "Flex rotates", FLEX_COLOR) + 8
    draw_chip(c, chip_x, chip_y, "Finals stay snake draft", SUB_COLOR)


def panel_positions():
    available_height = PAGE_HEIGHT - (MARGIN * 2) - HEADER_HEIGHT - FOOTER_HEIGHT - GUTTER
    panel_height = (available_height - GUTTER) / 2
    panel_width = (PAGE_WIDTH - (MARGIN * 2) - GUTTER) / 2
    top_row_y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT - GUTTER - panel_height
    bottom_row_y = MARGIN + FOOTER_HEIGHT
    left_x = MARGIN
    right_x = MARGIN + panel_width + GUTTER
    return {
        "top_left": (left_x, top_row_y, panel_width, panel_height),
        "top_right": (right_x, top_row_y, panel_width, panel_height),
        "bottom_left": (left_x, bottom_row_y, panel_width, panel_height),
        "bottom_right": (right_x, bottom_row_y, panel_width, panel_height),
    }


def draw_panel_frame(c: canvas.Canvas, x: float, y: float, width: float, height: float, title: str, eyebrow: str):
    draw_round_panel(c, x, y, width, height, fill=PANEL_BG, stroke=PANEL_BORDER)
    c.saveState()
    c.setStrokeColor(RULE)
    c.setLineWidth(1)
    c.line(x + PANEL_INSET, y + height - 40, x + width - PANEL_INSET, y + height - 40)
    c.restoreState()
    draw_paragraph(c, eyebrow, STYLES["PanelLabel"], x + PANEL_INSET, y + height - 14, width - (PANEL_INSET * 2))
    draw_paragraph(c, title, STYLES["PanelTitle"], x + PANEL_INSET, y + height - 28, width - (PANEL_INSET * 2))


def draw_weekly_spots_panel(c: canvas.Canvas, x: float, y: float, width: float, height: float):
    draw_panel_frame(c, x, y, width, height, "1. Weekly Spots", "Every week")

    visual_x = x + 16
    visual_y = y + 22
    visual_w = width * 0.46
    visual_h = height - 68
    text_x = visual_x + visual_w + 14
    text_w = width - (text_x - x) - 16

    lane_height = (visual_h - 18) / 3
    lanes = [
        ("Core", "Main spots fill first", CORE_COLOR, CORE_TOKEN_PATH, 4),
        ("Flex", "Shared spots rotate", FLEX_COLOR, FLEX_TOKEN_PATH, 3),
        ("Sub", "Extra cover if needed", SUB_COLOR, SUB_TOKEN_PATH, 2),
    ]
    for index, (label, note, color, image_path, count) in enumerate(lanes):
        lane_y = visual_y + (2 - index) * (lane_height + 9)
        c.saveState()
        c.setFillColor(PANEL_BG_ALT)
        c.setStrokeColor(color)
        c.roundRect(visual_x, lane_y, visual_w, lane_height, 14, fill=1, stroke=1)
        c.setFillColor(color)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(visual_x + 12, lane_y + lane_height - 18, label)
        c.setFillColor(TEXT_SOFT)
        c.setFont("Helvetica", 8.3)
        c.drawString(visual_x + 12, lane_y + lane_height - 30, note)
        draw_token_row(c, image_path, visual_x + 12, lane_y + 10, count, 28, 6)
        c.restoreState()

    text_top = y + height - 56
    draw_paragraph(
        c,
        (
            "Core players get first priority. After Core, the shared open spots go to Flex players in order."
        ),
        STYLES["PanelBody"],
        text_x,
        text_top,
        text_w,
    )
    draw_paragraph(
        c,
        "Normal weeks stay fairness-first: fewer turns means higher Flex priority.",
        STYLES["PanelBody"],
        text_x,
        text_top - 58,
        text_w,
    )
    draw_note_box(
        c,
        text_x,
        y + 18,
        text_w,
        54,
        "Quick summary",
        "Core first. Flex rotates next. Subs fill the remaining space. The app shows who is next.",
    )


def draw_snake_path(c: canvas.Canvas, x: float, y: float, width: float, height: float):
    row_gap = 16
    cell_gap = 8
    row_height = (height - row_gap) / 2
    cell_width = (width - cell_gap * 3) / 4

    c.saveState()
    for row in range(2):
        row_y = y + (1 - row) * (row_height + row_gap)
        values = [1, 2, 3, 4] if row == 0 else [4, 3, 2, 1]
        label = "Round 1" if row == 0 else "Round 2"
        c.setFillColor(TEXT_SOFT)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(x, row_y + row_height + 6, label)
        for index, value in enumerate(values):
            cell_x = x + index * (cell_width + cell_gap)
            c.setFillColor(HexColor("#173043"))
            c.setStrokeColor(PANEL_BORDER)
            c.roundRect(cell_x, row_y, cell_width, row_height, 12, fill=1, stroke=1)
            c.setFillColor(TEXT)
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(cell_x + cell_width / 2, row_y + row_height / 2 - 6, str(value))
    c.setStrokeColor(ACCENT)
    c.setLineWidth(4)
    c.roundRect(x + 2, y + row_height - 4, width - 4, 8, 4, fill=0, stroke=1)
    c.restoreState()


def draw_finals_panel(c: canvas.Canvas, x: float, y: float, width: float, height: float):
    draw_panel_frame(c, x, y, width, height, "2. Finals Still Use Snake Draft", "End of season")

    visual_x = x + 16
    visual_y = y + 28
    visual_w = width * 0.42
    visual_h = height - 80
    text_x = visual_x + visual_w + 16
    text_w = width - (text_x - x) - 16

    draw_snake_path(c, visual_x, visual_y + 8, visual_w, visual_h - 8)

    draw_chip(c, visual_x, y + 18, "Still decides top Core", CORE_COLOR)
    draw_chip(c, visual_x + 158, y + 18, "Also shapes Flex order", FLEX_COLOR)

    text_top = y + height - 56
    draw_paragraph(
        c,
        "Finals still use snake draft, and they still help decide the top Core players.",
        STYLES["PanelBody"],
        text_x,
        text_top,
        text_w,
    )
    draw_paragraph(
        c,
        "Finals now also help rank the Flex group.",
        STYLES["PanelBody"],
        text_x,
        text_top - 42,
        text_w,
    )
    draw_note_box(
        c,
        text_x,
        y + 18,
        text_w,
        52,
        "Final matchday",
        "Season results matter more at the end, so performance becomes more important as the season closes.",
    )


def draw_rewards_panel(c: canvas.Canvas, x: float, y: float, width: float, height: float):
    draw_panel_frame(c, x, y, width, height, "3. What Players Are Playing For", "Promotion and reward")

    visual_x = x + 12
    visual_y = y + 28
    visual_w = width * 0.44
    visual_h = height - 76
    text_x = visual_x + visual_w + 18
    text_w = width - (text_x - x) - 16

    bar_width = (visual_w - 24) / 3
    bar_x = visual_x + 6
    bar_y = visual_y
    bars = [
        ("Flex #2", "Core chance", BRONZE, FLEX_TOKEN_PATH, 72),
        ("Flex #1", "Core chance", SILVER, FLEX_TOKEN_PATH, 102),
        ("Core #1", "Wins jersey", GOLD, WINNER_TOKEN_PATH, 132),
    ]

    for index, (rank, note, color, image_path, bar_height) in enumerate(bars):
        current_x = bar_x + index * (bar_width + 6)
        c.saveState()
        c.setFillColor(color)
        c.roundRect(current_x, bar_y, bar_width, bar_height, 12, fill=1, stroke=0)
        draw_contain_image(c, image_path, current_x + (bar_width - 38) / 2, bar_y + bar_height - 30, 38, 38)
        c.setFillColor(BG)
        c.setFont("Helvetica-Bold", 8.8)
        c.drawCentredString(current_x + bar_width / 2, bar_y + 26, rank)
        c.setFont("Helvetica", 7.8)
        c.drawCentredString(current_x + bar_width / 2, bar_y + 14, note)
        c.restoreState()

    text_top = y + height - 56
    draw_paragraph(
        c,
        "The top 2 Flex players after Finals get the chance to move up to Core.",
        STYLES["PanelBody"],
        text_x,
        text_top,
        text_w,
    )
    draw_paragraph(
        c,
        "The top Core player wins the jersey, so Core players still have a clear prize to chase.",
        STYLES["PanelBody"],
        text_x,
        text_top - 42,
        text_w,
    )
    draw_note_box(
        c,
        text_x,
        y + 18,
        text_w,
        54,
        "Why it matters",
        "Both tiers still have something to play for: Flex can move up, and Core still has a top reward.",
    )


def draw_phone_card(c: canvas.Canvas, x: float, y: float, width: float, height: float, title: str, subtitle: str, token_path: Path):
    c.saveState()
    c.setFillColor(HexColor("#173043"))
    c.setStrokeColor(PANEL_BORDER)
    c.roundRect(x, y, width, height, 12, fill=1, stroke=1)
    c.setFillColor(HexColor("#0E1A28"))
    c.roundRect(x + 6, y + height - 11, width - 12, 5, 2, fill=1, stroke=0)
    draw_contain_image(c, token_path, x + 8, y + height - 39, 24, 24)
    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 8.6)
    c.drawString(x + 36, y + height - 22, title)
    c.setFillColor(TEXT_SOFT)
    c.setFont("Helvetica", 7.4)
    c.drawString(x + 10, y + 12, subtitle)
    c.restoreState()


def draw_app_panel(c: canvas.Canvas, x: float, y: float, width: float, height: float):
    draw_panel_frame(c, x, y, width, height, "4. How the App Helps", "Transparency")

    visual_x = x + 16
    visual_y = y + 26
    visual_w = width * 0.44
    visual_h = height - 74
    text_x = visual_x + visual_w + 16
    text_w = width - (text_x - x) - 16

    card_width = (visual_w - 10) / 2
    card_height = (visual_h - 10) / 2
    draw_phone_card(c, visual_x, visual_y + card_height + 10, card_width, card_height, "Flex queue", "Who is next", FLEX_TOKEN_PATH)
    draw_phone_card(c, visual_x + card_width + 10, visual_y + card_height + 10, card_width, card_height, "Current tier", "Core / Flex / Sub", CORE_TOKEN_PATH)
    draw_phone_card(c, visual_x, visual_y, card_width, card_height, "Next tier", "Where the data points", WINNER_TOKEN_PATH)
    draw_phone_card(c, visual_x + card_width + 10, visual_y, card_width, card_height, "Season stats", "Attendance and results", SUB_TOKEN_PATH)

    text_top = y + height - 56
    draw_paragraph(
        c,
        (
            "The app shows the live Flex queue, so players can see who is next without guessing."
        ),
        STYLES["PanelBody"],
        text_x,
        text_top,
        text_w,
    )
    draw_paragraph(
        c,
        (
            "It also shows current tier, suggested next tier, and the attendance and season evidence behind movement."
        ),
        STYLES["PanelBody"],
        text_x,
        text_top - 44,
        text_w,
    )
    draw_note_box(
        c,
        text_x,
        y + 18,
        text_w,
        58,
        "What the app does for the club",
        "Shows the queue, shows the recommendation, and makes the process easier to explain.",
    )


def draw_footer(c: canvas.Canvas):
    c.saveState()
    c.setStrokeColor(RULE)
    c.line(MARGIN, MARGIN + 6, PAGE_WIDTH - MARGIN, MARGIN + 6)
    c.setFillColor(TEXT_SOFT)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, MARGIN - 6, "Mandarinas Club Hub · Core + Flex explainer")
    c.drawRightString(PAGE_WIDTH - MARGIN, MARGIN - 6, "Updated May 2, 2026")
    c.restoreState()


def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(PDF_PATH), pagesize=landscape(letter))
    pdf.setTitle("Mandarinas Core + Flex System")
    pdf.setAuthor("OpenAI Codex")
    pdf.setSubject("Club explainer flyer")

    pdf.setFillColor(BG)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    draw_header(pdf)
    positions = panel_positions()
    draw_weekly_spots_panel(pdf, *positions["top_left"])
    draw_finals_panel(pdf, *positions["top_right"])
    draw_rewards_panel(pdf, *positions["bottom_left"])
    draw_app_panel(pdf, *positions["bottom_right"])
    draw_footer(pdf)

    pdf.showPage()
    pdf.save()


if __name__ == "__main__":
    build_pdf()
    print(PDF_PATH)
