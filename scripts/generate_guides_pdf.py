from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, StyleSheet1, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import ListFlowable, ListItem, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "deliverables" / "guides"

BRAND_DARK = colors.HexColor("#0F172A")
BRAND_PANEL = colors.HexColor("#F8FAFC")
BRAND_BORDER = colors.HexColor("#CBD5E1")
BRAND_ACCENT = colors.HexColor("#1F7660")
BRAND_ACCENT_SOFT = colors.HexColor("#E7F5F1")
TEXT_MUTED = colors.HexColor("#475569")


@dataclass(frozen=True)
class GuideMeta:
    filename: str
    title: str
    subtitle: str
    audience: str
    checked_date: str
    version_note: str
    callout_title: str
    callout_body: str
    quick_table_title: str
    quick_table_rows: list[tuple[str, str]]
    sections: list[dict]


def build_styles() -> StyleSheet1:
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="GuideTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            textColor=BRAND_DARK,
            spaceAfter=10,
            alignment=TA_LEFT,
        )
    )
    styles.add(
        ParagraphStyle(
            name="GuideSubtitle",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=TEXT_MUTED,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="GuideMeta",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=TEXT_MUTED,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            textColor=BRAND_DARK,
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubHeading",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=BRAND_DARK,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="GuideBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14.5,
            textColor=BRAND_DARK,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="GuideBullet",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.1,
            leading=14.25,
            textColor=BRAND_DARK,
            leftIndent=12,
            firstLineIndent=0,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallMuted",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.8,
            leading=12,
            textColor=TEXT_MUTED,
            spaceAfter=4,
        )
    )
    return styles


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(BRAND_BORDER)
    canvas.line(doc.leftMargin, 0.55 * inch, A4[0] - doc.rightMargin, 0.55 * inch)
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(doc.leftMargin, 0.33 * inch, "Mandarinas Club Hub Guides")
    canvas.drawRightString(A4[0] - doc.rightMargin, 0.33 * inch, f"Page {doc.page}")
    canvas.restoreState()


def info_box(title: str, body: str, styles: StyleSheet1) -> Table:
    content = [
        [Paragraph(f"<b>{title}</b>", styles["GuideBody"])],
        [Paragraph(body, styles["GuideBody"])],
    ]
    table = Table(content, colWidths=[6.7 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_ACCENT_SOFT),
                ("BOX", (0, 0), (-1, -1), 0.8, BRAND_ACCENT),
                ("INNERGRID", (0, 0), (-1, -1), 0, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def quick_table(title: str, rows: list[tuple[str, str]], styles: StyleSheet1) -> Table:
    data = [[Paragraph(f"<b>{title}</b>", styles["GuideBody"]), ""]]
    for label, value in rows:
        data.append(
            [
                Paragraph(f"<b>{label}</b>", styles["GuideBody"]),
                Paragraph(value, styles["GuideBody"]),
            ]
        )

    table = Table(data, colWidths=[1.7 * inch, 5.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (-1, 0)),
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), BRAND_PANEL),
                ("BOX", (0, 0), (-1, -1), 0.8, BRAND_BORDER),
                ("INNERGRID", (0, 1), (-1, -1), 0.6, BRAND_BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def bullet_list(items: list[str], styles: StyleSheet1) -> ListFlowable:
    return ListFlowable(
        [
            ListItem(Paragraph(item, styles["GuideBullet"]), leftIndent=6)
            for item in items
        ],
        bulletType="bullet",
        start="circle",
        leftIndent=10,
    )


def build_story(meta: GuideMeta, styles: StyleSheet1):
    story = []
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(meta.title, styles["GuideTitle"]))
    story.append(Paragraph(meta.subtitle, styles["GuideSubtitle"]))
    story.append(Paragraph(f"<b>{meta.audience}</b>", styles["GuideMeta"]))
    story.append(Paragraph(meta.checked_date, styles["GuideMeta"]))
    story.append(Paragraph(meta.version_note, styles["GuideMeta"]))
    story.append(Spacer(1, 0.08 * inch))
    story.append(info_box(meta.callout_title, meta.callout_body, styles))
    story.append(Spacer(1, 0.18 * inch))
    story.append(quick_table(meta.quick_table_title, meta.quick_table_rows, styles))
    story.append(Spacer(1, 0.12 * inch))

    for index, section in enumerate(meta.sections):
        if index == 3:
            story.append(PageBreak())
        story.append(Paragraph(section["heading"], styles["SectionHeading"]))
        for paragraph in section.get("paragraphs", []):
            story.append(Paragraph(paragraph, styles["GuideBody"]))
        for subheading, bullets in section.get("lists", []):
            story.append(Paragraph(subheading, styles["SubHeading"]))
            story.append(bullet_list(bullets, styles))
            story.append(Spacer(1, 0.05 * inch))
    return story


def build_pdf(meta: GuideMeta):
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT_DIR / meta.filename),
        pagesize=A4,
        rightMargin=0.68 * inch,
        leftMargin=0.68 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.75 * inch,
        title=meta.title,
        author="OpenAI Codex",
        subject="Mandarinas Club Hub guide",
    )
    doc.build(build_story(meta, styles), onFirstPage=footer, onLaterPages=footer)


GUIDES = [
    GuideMeta(
        filename="mandarinas-admin-guide-en.pdf",
        title="Mandarinas Club Hub Admin Guide",
        subtitle="Operational guide for the Busses workspace",
        audience="Audience: Busses admins and club operators",
        checked_date="Verified against the local app on April 26, 2026.",
        version_note="This guide matches the current static app routes and live Supabase-backed save flows.",
        callout_title="Current operating note",
        callout_body=(
            "This app is live-backed. Successful save, approve, update, insert, and delete actions in the Busses "
            "workspace write to the current Supabase project. The admin gate is still a browser code, not full "
            "account-based authentication, so use the Busses area carefully."
        ),
        quick_table_title="Quick Path",
        quick_table_rows=[
            ("Enter admin side", "Open <b>Busses</b> from any public page, choose <b>Enter busses workspace</b>, and enter the current code."),
            ("Core admin pages", "Directory, Season, Matchday, Planner, and Standings."),
            ("Live approvals", "Public squad requests are reviewed in <b>Season Centre</b> under <b>Pending squad requests</b>."),
            ("Public report testing", "Use <b>Open report preview</b> from Match Centre to test the player-report flow."),
        ],
        sections=[
            {
                "heading": "1. Accessing the Busses Workspace",
                "paragraphs": [
                    "The public club pages and the Busses workspace are intentionally separated. Admin access is opened per browser tab, so one tab can stay on the public side while another tab is unlocked for operations.",
                    "When you return to the public site or open a fresh tab, you may need to enter the Busses code again. The guide does not print the code itself; use the current internal code your team shares."
                ],
                "lists": [
                    (
                        "Access steps",
                        [
                            "From any public page, select <b>Busses</b> in the top-right corner.",
                            "Select <b>Enter busses workspace</b>.",
                            "Enter the current Busses code.",
                            "After the code is accepted, the app opens the Busses workspace for that tab and sends you to <b>Season Centre</b> by default.",
                        ],
                    )
                ],
            },
            {
                "heading": "2. Directory: Squad Register",
                "paragraphs": [
                    "Use <b>Directory</b> to maintain the master player register. This is the source list the season tools and late-replacement tools pull from.",
                    "The page is split into a browse flow and an add-player flow. Existing players are reviewed from the list and their detail page. New profiles are created from the add form."
                ],
                "lists": [
                    (
                        "What admins do here",
                        [
                            "Search and filter the player register by name, nickname, nationality, notes, or current tier.",
                            "Set each player's <b>current / next-season tier</b> so Season Centre can bulk-load the right group.",
                            "Create a new player profile with name, nationality, phone, birth date, preferred foot, positions, rating, and notes.",
                            "Use this page before season setup whenever the directory needs cleanup or a new player must exist before a request can be approved.",
                        ],
                    )
                ],
            },
            {
                "heading": "3. Season Centre",
                "paragraphs": [
                    "Use <b>Season Centre</b> to create and manage campaigns. The workspace is split into <b>Season list</b>, <b>Create</b>, <b>Squad</b>, and <b>Fixtures</b> so each operation stays focused.",
                    "This is also the page where public squad requests are approved or denied."
                ],
                "lists": [
                    (
                        "Create and configure a season",
                        [
                            "Create a season with a name, total matchdays, Core target, Rotation target, queue start matchday, and optional weekly kickoff defaults.",
                            "Use <b>Season settings</b> to update targets, queue start, weekly defaults, and venue after creation.",
                            "If defaults are set, use <b>Fill unscheduled matchdays</b> to push the weekly schedule into pending matchdays.",
                        ],
                    ),
                    (
                        "Manage the season squad",
                        [
                            "Use <b>Add current Core + Rotation</b> to bulk-seed the season from the Squad Register tier settings.",
                            "Use <b>Use squad tier status</b> when season roster tiers have drifted away from the register's current / next-season tiers.",
                            "Add a single player from the register with the season-tier, live-tier, and payment controls in <b>Squad tools</b>.",
                            "Review the live roster in <b>Season roster players</b> for tiers, payment status, and active season membership.",
                        ],
                    ),
                    (
                        "Handle public roster requests",
                        [
                            "Open <b>Pending squad requests</b> inside the season's <b>Squad</b> workspace.",
                            "Use <b>Approve into season</b> when the requester already exists in the main directory.",
                            "Use <b>Approve to directory + season</b> when the requester needs a new directory profile created first.",
                            "Use <b>Deny</b> when the request should not move forward.",
                            "Approved requests are marked reviewed and linked to the created or matched player record.",
                        ],
                    ),
                    (
                        "Schedule fixtures",
                        [
                            "Open <b>Fixtures</b> for the selected season.",
                            "Save kickoff date and time for each matchday one by one, or rely on the saved weekly defaults when available.",
                            "Use each matchday card's link to jump directly into Match Centre for that night.",
                        ],
                    ),
                ],
            },
            {
                "heading": "4. Match Centre",
                "paragraphs": [
                    "Use <b>Matchday</b> to run the current night. Match Centre opens the next incomplete night for a selected season and uses only players already active on that season roster.",
                    "This page combines attendance, late replacements, team assignment, stat entry, results, scoring settings, and team-label editing."
                ],
                "lists": [
                    (
                        "Core night workflow",
                        [
                            "Open the night for the target campaign.",
                            "Set attendance first. Only players marked <b>IN</b> can be assigned to teams.",
                            "Use <b>Apply queue priority</b> when you want the model-era attendance order to shape selection.",
                            "Assign checked-in players to the four teams in <b>Teams and Player Stats</b>.",
                            "Enter official player stats from the team cards as needed.",
                            "Save the bracket scores in <b>Match Results</b>.",
                        ],
                    ),
                    (
                        "Support tools",
                        [
                            "Use <b>Late replacements</b> only when a replacement exists in the main register but is missing from the current season roster.",
                            "Use <b>Goal rule</b> and <b>Scoring settings</b> to control how points are counted.",
                            "Use <b>Team labels</b> to update shared team names and colors used on both admin and club screens.",
                            "Use <b>Open report preview</b> to test the public player-report flow against the selected matchday.",
                        ],
                    ),
                ],
            },
            {
                "heading": "5. Planner and Standings",
                "paragraphs": [
                    "Use <b>Planner</b> and <b>Standings</b> after season roster, attendance, stats, and results are in good shape.",
                ],
                "lists": [
                    (
                        "Planner",
                        [
                            "The <b>Live Queue</b> shows the current queue order for the selected season.",
                            "The <b>Recommended Tier Plan</b> is forward-looking and should be reviewed before applying.",
                            "Use <b>Apply all recommendations</b> only after reviewing the recommendation board.",
                        ],
                    ),
                    (
                        "Standings",
                        [
                            "Standings only count <b>fully scored matchdays</b> and only include the active season roster.",
                            "Use the search and tier filters to review subsets of the table.",
                            "Use standings as an operational check after results and official stats are saved.",
                        ],
                    ),
                ],
            },
            {
                "heading": "6. Admin Cautions and Troubleshooting",
                "paragraphs": [
                    "The current app is useful and live-backed, but it is not yet locked down like a production account-based admin tool.",
                ],
                "lists": [
                    (
                        "Important cautions",
                        [
                            "The Busses gate is a browser code, not full role-based login.",
                            "Public squad requests, player stat submissions, ratings, suggestions, replies, and likes all save live when the success state appears.",
                            "Player-submitted stats and ratings are not the canonical record until Busses reviews and confirms the official night.",
                            "Access is per tab. If a tab is refreshed or replaced, you may need to re-enter the Busses code.",
                        ],
                    ),
                    (
                        "Fast troubleshooting",
                        [
                            "If a player is missing in Match Centre, first confirm they are on the selected season roster.",
                            "If public requests are not visible, confirm you are inside the correct season and open <b>Pending squad requests</b>.",
                            "If standings look incomplete, confirm the matchday results and official stats are fully saved.",
                            "If the public report flow looks closed, check the active matchday window or open the preview from Match Centre for testing.",
                        ],
                    ),
                ],
            },
        ],
    ),
    GuideMeta(
        filename="mandarinas-user-guide-en.pdf",
        title="Mandarinas Club Hub User Guide",
        subtitle="Public-side guide for players and club visitors",
        audience="Audience: players, squad candidates, and club followers",
        checked_date="Verified against the local app on April 26, 2026.",
        version_note="This guide matches the current public routes and live save buttons on the club side.",
        callout_title="Current operating note",
        callout_body=(
            "The public app is live-backed. Successful roster requests, player-report saves, ratings, suggestions, replies, and likes write to the current Supabase project. "
            "The product still does not use personal player accounts, so choose your own name carefully before saving anything."
        ),
        quick_table_title="Quick Path",
        quick_table_rows=[
            ("Main public pages", "Home, Season, Squad, Match Videos, and Suggestions."),
            ("Join the club", "Use the request forms at the bottom of <b>Squad</b>."),
            ("Report a matchday", "Use <b>Player Report</b> to save your stats and rate teammates when the window is open."),
            ("Discuss a night", "Switch to the <b>Suggestions</b> board to post, reply, and like matchday ideas."),
        ],
        sections=[
            {
                "heading": "1. Public Pages You Can Use",
                "paragraphs": [
                    "The public side of Mandarinas Club Hub is built for browsing, joining, and participating without entering the Busses workspace.",
                ],
                "lists": [
                    (
                        "What each page is for",
                        [
                            "<b>Home</b>: season summary, next kickoff, recent results, and current leaders.",
                            "<b>Season</b>: matchday list and fixture detail for the selected season.",
                            "<b>Squad</b>: player directory, search, filters, and join-request forms.",
                            "<b>Match Videos</b>: public Mandarinas CF YouTube uploads in newest-first order.",
                            "<b>Suggestions</b>: the matchday discussion board for ideas, replies, and likes.",
                        ],
                    )
                ],
            },
            {
                "heading": "2. How to Request a Squad Spot",
                "paragraphs": [
                    "The request tools live at the bottom of the <b>Squad</b> page. Which form you use depends on whether you are already in the club's main directory.",
                ],
                "lists": [
                    (
                        "If you already exist in the main directory",
                        [
                            "Open <b>Squad</b>.",
                            "Find the section <b>Already in the main directory</b>.",
                            "Choose your directory profile.",
                            "Select the season tier you want to request.",
                            "Optionally add contact details and a note for the Busses team.",
                            "Select <b>Request season squad spot</b>.",
                        ],
                    ),
                    (
                        "If you are not in the main directory yet",
                        [
                            "Use the form <b>Not in the main directory yet</b>.",
                            "Enter your first name, last name, nationality, position, requested season tier, and contact.",
                            "Optionally leave a note.",
                            "Select <b>Request directory + season review</b>.",
                        ],
                    ),
                    (
                        "What happens next",
                        [
                            "Your request is saved immediately when the success message appears.",
                            "You do <b>not</b> appear on the live season squad until a Busses admin approves the request.",
                            "If your name already exists in the directory, use the directory-profile request instead of creating a duplicate request.",
                        ],
                    ),
                ],
            },
            {
                "heading": "3. How to Submit a Player Report",
                "paragraphs": [
                    "Use <b>Player Report</b> after a completed night. The page loads your matchday context after you choose your name.",
                    "The report page keeps your player-submitted entries separate from the official Busses record until they are reviewed."
                ],
                "lists": [
                    (
                        "Stats flow",
                        [
                            "Open the report page for the current matchday.",
                            "Choose your name from the player list for that night.",
                            "Review the match hub details and the score card.",
                            "Enter goals, goalkeeper points, and clean-sheet status if needed.",
                            "Optionally leave a note for the admin team.",
                            "Select <b>Save my stats</b>.",
                        ],
                    ),
                    (
                        "Ratings flow",
                        [
                            "Stay in <b>Report</b> mode after choosing your name.",
                            "Move through the teammate queue one player at a time.",
                            "Give each teammate an overall rating and optionally leave a comment.",
                            "Select <b>Save rating</b> for each player.",
                            "Use <b>Next player</b> to move through the queue faster.",
                        ],
                    ),
                    (
                        "When the report is available",
                        [
                            "Stats and ratings open only when the current matchday window is open, or when Busses is running the preview/test flow.",
                            "If the page says the report window is closed, wait for the matchday window or contact the Busses team.",
                            "If your name is missing, you were either not saved on that matchday or not included on the selected season roster.",
                        ],
                    ),
                ],
            },
            {
                "heading": "4. How to Use the Suggestions Board",
                "paragraphs": [
                    "Suggestions are tied to a matchday. The board is meant for ideas, not official scoring changes.",
                ],
                "lists": [
                    (
                        "Board actions",
                        [
                            "Open <b>Suggestions</b> from the main navigation or switch to the <b>Suggestions</b> tab inside the report workspace.",
                            "Choose your name first.",
                            "Select a matchday if the page prompts for one.",
                            "Post a title and a full suggestion message.",
                            "Reply inside any thread to continue the discussion.",
                            "Like a suggestion or reply to push useful ideas upward.",
                        ],
                    )
                ],
            },
            {
                "heading": "5. What Saves Live and What Still Needs Approval",
                "paragraphs": [
                    "The public side does save live data, but not every saved item becomes official immediately.",
                ],
                "lists": [
                    (
                        "Saved immediately",
                        [
                            "Squad requests",
                            "Player stat submissions",
                            "Player ratings",
                            "Suggestions, replies, and likes",
                        ],
                    ),
                    (
                        "Still reviewed by admins",
                        [
                            "Season squad requests must be approved before you appear on the live season roster.",
                            "Player-report stats remain separate from the official Busses night record until reviewed.",
                            "Ratings are saved live but should be treated as part of the player feedback flow, not the official standings engine.",
                        ],
                    ),
                ],
            },
            {
                "heading": "6. Limits and Good Habits",
                "paragraphs": [
                    "This product is already useful, but it does not yet run on personal player accounts.",
                ],
                "lists": [
                    (
                        "Good habits",
                        [
                            "Always choose your own name carefully before saving a report, rating, or suggestion.",
                            "Use the public pages unless the club specifically asked you to open the Busses side.",
                            "If a save button succeeds, assume the entry is live and avoid submitting duplicates.",
                            "If something looks wrong, leave a note in the report or contact the Busses team instead of guessing.",
                        ],
                    ),
                    (
                        "Common issues",
                        [
                            "If a request does not show on the squad immediately, it is probably waiting for admin approval.",
                            "If a matchday is missing from the report flow, the season or kickoff may not be set correctly yet.",
                            "If a dropdown is empty, refresh once and then contact the Busses team if the issue stays.",
                        ],
                    ),
                ],
            },
        ],
    ),
    GuideMeta(
        filename="mandarinas-admin-guide-es.pdf",
        title="Guia de Administracion de Mandarinas Club Hub",
        subtitle="Guia operativa para el espacio Busses",
        audience="Audiencia: administradores de Busses y operadores del club",
        checked_date="Verificado contra la app local el 26 de abril de 2026.",
        version_note="Esta guia coincide con las rutas actuales de la app estatica y con los flujos de guardado en Supabase.",
        callout_title="Nota operativa actual",
        callout_body=(
            "Esta app guarda datos reales. Las acciones exitosas de guardar, aprobar, actualizar, insertar y borrar dentro del espacio Busses escriben en el proyecto actual de Supabase. "
            "La entrada de admin sigue siendo un codigo en el navegador, no una autenticacion completa por cuentas, asi que usa el area Busses con cuidado."
        ),
        quick_table_title="Ruta Rapida",
        quick_table_rows=[
            ("Entrar al lado admin", "Abre <b>Busses</b> desde cualquier pagina publica, elige <b>Enter busses workspace</b> e ingresa el codigo actual."),
            ("Paginas admin principales", "Directory, Season, Matchday, Planner y Standings."),
            ("Aprobaciones en vivo", "Las solicitudes publicas de plantilla se revisan en <b>Season Centre</b> dentro de <b>Pending squad requests</b>."),
            ("Prueba del reporte publico", "Usa <b>Open report preview</b> desde Match Centre para probar el flujo del reporte de jugadores."),
        ],
        sections=[
            {
                "heading": "1. Acceso al Espacio Busses",
                "paragraphs": [
                    "Las paginas publicas del club y el espacio Busses estan separados a proposito. El acceso admin se abre por pestaña del navegador, asi que una pestaña puede quedarse en el lado publico mientras otra queda desbloqueada para operaciones.",
                    "Cuando regreses al sitio publico o abras una pestaña nueva, puede que tengas que volver a ingresar el codigo de Busses. Esta guia no imprime el codigo; usa el codigo interno actual de tu equipo."
                ],
                "lists": [
                    (
                        "Pasos de acceso",
                        [
                            "Desde cualquier pagina publica, selecciona <b>Busses</b> arriba a la derecha.",
                            "Selecciona <b>Enter busses workspace</b>.",
                            "Ingresa el codigo actual de Busses.",
                            "Cuando el codigo se acepta, la app abre el espacio Busses para esa pestaña y te lleva a <b>Season Centre</b> por defecto.",
                        ],
                    )
                ],
            },
            {
                "heading": "2. Directory: Registro de Jugadores",
                "paragraphs": [
                    "Usa <b>Directory</b> para mantener el registro maestro de jugadores. Esta es la lista base que usan las herramientas de temporada y los reemplazos de ultima hora.",
                    "La pagina se divide en navegacion y alta de jugador. Los jugadores existentes se revisan desde la lista y su pagina de detalle. Los perfiles nuevos se crean desde el formulario."
                ],
                "lists": [
                    (
                        "Que se hace aqui",
                        [
                            "Buscar y filtrar el registro por nombre, apodo, nacionalidad, notas o tier actual.",
                            "Definir el <b>current / next-season tier</b> de cada jugador para que Season Centre cargue el grupo correcto.",
                            "Crear un perfil nuevo con nombre, nacionalidad, telefono, fecha de nacimiento, pierna habil, posiciones, rating y notas.",
                            "Usar esta pagina antes de preparar una temporada cuando el directorio necesita limpieza o cuando hace falta crear un jugador antes de aprobar una solicitud.",
                        ],
                    )
                ],
            },
            {
                "heading": "3. Season Centre",
                "paragraphs": [
                    "Usa <b>Season Centre</b> para crear y gestionar temporadas. El espacio se divide en <b>Season list</b>, <b>Create</b>, <b>Squad</b> y <b>Fixtures</b> para mantener cada operacion enfocada.",
                    "Esta tambien es la pagina donde se aprueban o rechazan las solicitudes publicas de plantilla."
                ],
                "lists": [
                    (
                        "Crear y configurar una temporada",
                        [
                            "Crear una temporada con nombre, total de matchdays, objetivo Core, objetivo Rotation, matchday de inicio de cola y valores semanales opcionales.",
                            "Usar <b>Season settings</b> para actualizar objetivos, inicio de cola, valores semanales y sede despues de crearla.",
                            "Si ya existen valores por defecto, usar <b>Fill unscheduled matchdays</b> para empujar ese calendario semanal a los matchdays pendientes.",
                        ],
                    ),
                    (
                        "Gestionar la plantilla de temporada",
                        [
                            "Usar <b>Add current Core + Rotation</b> para sembrar la temporada desde los tiers del Squad Register.",
                            "Usar <b>Use squad tier status</b> cuando los tiers del roster de temporada se hayan desalineado del current / next-season tier del registro.",
                            "Agregar un jugador puntual desde el registro con los controles de tier de temporada, tier en vivo y pago dentro de <b>Squad tools</b>.",
                            "Revisar el roster activo en <b>Season roster players</b> para ver tiers, estado de pago y membresia activa de temporada.",
                        ],
                    ),
                    (
                        "Atender solicitudes publicas",
                        [
                            "Abrir <b>Pending squad requests</b> dentro del espacio <b>Squad</b> de la temporada.",
                            "Usar <b>Approve into season</b> cuando la persona ya existe en el directorio principal.",
                            "Usar <b>Approve to directory + season</b> cuando primero hay que crear un perfil nuevo en el directorio.",
                            "Usar <b>Deny</b> cuando la solicitud no debe avanzar.",
                            "Las solicitudes aprobadas quedan marcadas como revisadas y vinculadas al jugador creado o encontrado.",
                        ],
                    ),
                    (
                        "Programar fixtures",
                        [
                            "Abrir <b>Fixtures</b> para la temporada seleccionada.",
                            "Guardar fecha y hora de kickoff para cada matchday uno por uno, o apoyarte en los valores semanales guardados cuando existan.",
                            "Usar el enlace de cada tarjeta de matchday para saltar directo a Match Centre de esa noche.",
                        ],
                    ),
                ],
            },
            {
                "heading": "4. Match Centre",
                "paragraphs": [
                    "Usa <b>Matchday</b> para correr la noche actual. Match Centre abre la siguiente noche incompleta de la temporada seleccionada y solo usa jugadores ya activos en ese roster de temporada.",
                    "Esta pagina combina asistencia, reemplazos tardios, asignacion de equipos, captura de stats, resultados, reglas de puntuacion y etiquetas de equipo."
                ],
                "lists": [
                    (
                        "Flujo principal de la noche",
                        [
                            "Abrir la noche para la temporada objetivo.",
                            "Definir asistencia primero. Solo los jugadores marcados como <b>IN</b> se pueden asignar a equipos.",
                            "Usar <b>Apply queue priority</b> cuando quieras que el orden por asistencia de la era del modelo guie la seleccion.",
                            "Asignar a los jugadores chequeados a los cuatro equipos dentro de <b>Teams and Player Stats</b>.",
                            "Capturar los stats oficiales de jugadores desde las tarjetas de equipo cuando haga falta.",
                            "Guardar los marcadores del bracket en <b>Match Results</b>.",
                        ],
                    ),
                    (
                        "Herramientas de apoyo",
                        [
                            "Usar <b>Late replacements</b> solo cuando el reemplazo existe en el registro principal pero falta en el roster de temporada actual.",
                            "Usar <b>Goal rule</b> y <b>Scoring settings</b> para controlar como se cuentan los puntos.",
                            "Usar <b>Team labels</b> para actualizar nombres y colores que luego aparecen tanto en admin como en el lado publico.",
                            "Usar <b>Open report preview</b> para probar el flujo publico del reporte contra el matchday seleccionado.",
                        ],
                    ),
                ],
            },
            {
                "heading": "5. Planner y Standings",
                "paragraphs": [
                    "Usa <b>Planner</b> y <b>Standings</b> despues de dejar en buen estado el roster, la asistencia, los stats y los resultados.",
                ],
                "lists": [
                    (
                        "Planner",
                        [
                            "La <b>Live Queue</b> muestra el orden actual de cola para la temporada elegida.",
                            "El <b>Recommended Tier Plan</b> es una recomendacion hacia adelante y se debe revisar antes de aplicar cambios.",
                            "Usa <b>Apply all recommendations</b> solo despues de revisar la tabla de recomendaciones.",
                        ],
                    ),
                    (
                        "Standings",
                        [
                            "Standings solo cuenta <b>matchdays completamente puntuados</b> y solo incluye el roster activo de temporada.",
                            "Usa la busqueda y los filtros por tier para revisar subconjuntos de la tabla.",
                            "Toma standings como chequeo operativo despues de guardar resultados y stats oficiales.",
                        ],
                    ),
                ],
            },
            {
                "heading": "6. Precauciones y Resolucion Rapida",
                "paragraphs": [
                    "La app actual es util y ya guarda en vivo, pero todavia no esta cerrada como una herramienta admin de produccion con cuentas y roles reales.",
                ],
                "lists": [
                    (
                        "Precauciones importantes",
                        [
                            "La entrada a Busses es un codigo en el navegador, no un login con roles reales.",
                            "Las solicitudes publicas, stats de jugadores, ratings, sugerencias, respuestas y likes se guardan en vivo cuando aparece el estado de exito.",
                            "Los stats y ratings enviados por jugadores no son el registro canonico hasta que Busses revise y confirme la noche oficial.",
                            "El acceso es por pestaña. Si una pestaña se refresca o se reemplaza, puede que debas volver a ingresar el codigo.",
                        ],
                    ),
                    (
                        "Resolucion rapida",
                        [
                            "Si falta un jugador en Match Centre, primero confirma que este en el roster de la temporada seleccionada.",
                            "Si no ves solicitudes publicas, confirma que estas dentro de la temporada correcta y abre <b>Pending squad requests</b>.",
                            "Si standings se ve incompleto, confirma que resultados y stats oficiales de ese matchday esten completos.",
                            "Si el flujo publico del reporte aparece cerrado, revisa la ventana activa del matchday o abre el preview desde Match Centre para probar.",
                        ],
                    ),
                ],
            },
        ],
    ),
    GuideMeta(
        filename="mandarinas-user-guide-es.pdf",
        title="Guia de Uso de Mandarinas Club Hub",
        subtitle="Guia publica para jugadores y visitantes del club",
        audience="Audiencia: jugadores, candidatos para la plantilla y seguidores del club",
        checked_date="Verificado contra la app local el 26 de abril de 2026.",
        version_note="Esta guia coincide con las rutas publicas actuales y con los botones de guardado del lado del club.",
        callout_title="Nota operativa actual",
        callout_body=(
            "La app publica ya guarda datos reales. Las solicitudes de plantilla, reportes de jugador, ratings, sugerencias, respuestas y likes se escriben en el proyecto actual de Supabase cuando el guardado termina con exito. "
            "El producto todavia no usa cuentas personales por jugador, asi que elige tu propio nombre con cuidado antes de guardar."
        ),
        quick_table_title="Ruta Rapida",
        quick_table_rows=[
            ("Paginas publicas", "Home, Season, Squad, Match Videos y Suggestions."),
            ("Unirte al club", "Usa los formularios al final de <b>Squad</b>."),
            ("Reportar un matchday", "Usa <b>Player Report</b> para guardar tus stats y calificar companeros cuando la ventana este abierta."),
            ("Hablar de la noche", "Cambia al tablero de <b>Suggestions</b> para publicar, responder y dar like a ideas del matchday."),
        ],
        sections=[
            {
                "heading": "1. Paginas Publicas que Puedes Usar",
                "paragraphs": [
                    "El lado publico de Mandarinas Club Hub esta pensado para ver informacion, pedir un lugar, y participar sin entrar al espacio Busses.",
                ],
                "lists": [
                    (
                        "Para que sirve cada pagina",
                        [
                            "<b>Home</b>: resumen de la temporada, siguiente kickoff, resultados recientes y lideres actuales.",
                            "<b>Season</b>: lista de matchdays y detalle de fixtures de la temporada seleccionada.",
                            "<b>Squad</b>: directorio de jugadores, busqueda, filtros y formularios para pedir entrada.",
                            "<b>Match Videos</b>: videos publicos del canal de YouTube de Mandarinas CF en orden del mas nuevo al mas antiguo.",
                            "<b>Suggestions</b>: tablero de discusion del matchday para ideas, respuestas y likes.",
                        ],
                    )
                ],
            },
            {
                "heading": "2. Como Pedir un Lugar en la Plantilla",
                "paragraphs": [
                    "Las herramientas de solicitud estan al final de la pagina <b>Squad</b>. El formulario correcto depende de si ya existes o no en el directorio principal del club.",
                ],
                "lists": [
                    (
                        "Si ya existes en el directorio principal",
                        [
                            "Abre <b>Squad</b>.",
                            "Busca la seccion <b>Already in the main directory</b>.",
                            "Elige tu perfil del directorio.",
                            "Selecciona el tier de temporada que quieres pedir.",
                            "Opcionalmente agrega contacto y una nota para el equipo Busses.",
                            "Selecciona <b>Request season squad spot</b>.",
                        ],
                    ),
                    (
                        "Si todavia no estas en el directorio principal",
                        [
                            "Usa el formulario <b>Not in the main directory yet</b>.",
                            "Ingresa nombre, apellido, nacionalidad, posicion, tier solicitado y contacto.",
                            "Opcionalmente deja una nota.",
                            "Selecciona <b>Request directory + season review</b>.",
                        ],
                    ),
                    (
                        "Que pasa despues",
                        [
                            "Tu solicitud se guarda de inmediato cuando aparece el mensaje de exito.",
                            "No apareces en la plantilla activa de la temporada hasta que un admin de Busses apruebe la solicitud.",
                            "Si tu nombre ya existe en el directorio, usa la solicitud con perfil existente y evita duplicados.",
                        ],
                    ),
                ],
            },
            {
                "heading": "3. Como Enviar tu Reporte de Jugador",
                "paragraphs": [
                    "Usa <b>Player Report</b> despues de una noche completada. La pagina carga tu contexto del matchday cuando eliges tu nombre.",
                    "La pagina mantiene tus entradas separadas del registro oficial de Busses hasta que se revisen."
                ],
                "lists": [
                    (
                        "Flujo de stats",
                        [
                            "Abre la pagina del reporte para el matchday actual.",
                            "Elige tu nombre de la lista de jugadores de esa noche.",
                            "Revisa la informacion del match hub y la tarjeta de marcadores.",
                            "Ingresa goles, puntos de portero y clean sheet si hace falta.",
                            "Opcionalmente deja una nota para el equipo admin.",
                            "Selecciona <b>Save my stats</b>.",
                        ],
                    ),
                    (
                        "Flujo de ratings",
                        [
                            "Quedate en modo <b>Report</b> despues de elegir tu nombre.",
                            "Avanza por la cola de companeros un jugador a la vez.",
                            "Da una calificacion general a cada companero y, si quieres, agrega un comentario.",
                            "Selecciona <b>Save rating</b> para cada jugador.",
                            "Usa <b>Next player</b> para avanzar mas rapido por la cola.",
                        ],
                    ),
                    (
                        "Cuando esta disponible el reporte",
                        [
                            "Los stats y ratings se abren solo cuando la ventana del matchday esta abierta, o cuando Busses esta usando el flujo de preview/prueba.",
                            "Si la pagina dice que la ventana de reporte esta cerrada, espera a que se abra o contacta al equipo Busses.",
                            "Si tu nombre no aparece, o no quedaste guardado en ese matchday o no estas incluido en el roster de la temporada seleccionada.",
                        ],
                    ),
                ],
            },
            {
                "heading": "4. Como Usar el Tablero de Suggestions",
                "paragraphs": [
                    "Las sugerencias quedan ligadas a un matchday. El tablero es para ideas y comentarios, no para cambiar marcadores oficiales.",
                ],
                "lists": [
                    (
                        "Acciones del tablero",
                        [
                            "Abre <b>Suggestions</b> desde la navegacion principal o cambia a la pestana <b>Suggestions</b> dentro del espacio del reporte.",
                            "Elige tu nombre primero.",
                            "Selecciona un matchday si la pagina te lo pide.",
                            "Publica un titulo y un mensaje completo.",
                            "Responde dentro de cualquier hilo para continuar la conversacion.",
                            "Da like a una sugerencia o respuesta para subir las ideas mas utiles.",
                        ],
                    )
                ],
            },
            {
                "heading": "5. Que se Guarda en Vivo y Que Sigue Pendiente",
                "paragraphs": [
                    "El lado publico si guarda datos en vivo, pero no todo lo guardado se vuelve oficial de inmediato.",
                ],
                "lists": [
                    (
                        "Se guarda de inmediato",
                        [
                            "Solicitudes de plantilla",
                            "Envios de stats de jugadores",
                            "Ratings de jugadores",
                            "Sugerencias, respuestas y likes",
                        ],
                    ),
                    (
                        "Todavia requiere revision admin",
                        [
                            "Las solicitudes de plantilla deben aprobarse antes de aparecer en el roster activo.",
                            "Los stats enviados en el reporte se mantienen separados del registro oficial hasta que Busses los revise.",
                            "Los ratings se guardan en vivo, pero deben entenderse como parte del flujo de feedback y no como el motor oficial de standings.",
                        ],
                    ),
                ],
            },
            {
                "heading": "6. Limites y Buenas Practicas",
                "paragraphs": [
                    "Este producto ya es util, pero todavia no funciona con cuentas personales por jugador.",
                ],
                "lists": [
                    (
                        "Buenas practicas",
                        [
                            "Elige tu propio nombre con cuidado antes de guardar un reporte, rating o sugerencia.",
                            "Usa las paginas publicas salvo que el club te pida entrar al lado Busses.",
                            "Si un boton de guardado marca exito, asume que la entrada ya quedo en vivo y evita duplicados.",
                            "Si algo se ve mal, deja una nota en el reporte o contacta al equipo Busses en vez de adivinar.",
                        ],
                    ),
                    (
                        "Problemas comunes",
                        [
                            "Si una solicitud no aparece en la plantilla enseguida, probablemente esta esperando aprobacion admin.",
                            "Si falta un matchday en el flujo del reporte, la temporada o el kickoff quizas todavia no estan listos.",
                            "Si un selector sale vacio, recarga una vez y luego contacta al equipo Busses si el problema sigue.",
                        ],
                    ),
                ],
            },
        ],
    ),
]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for guide in GUIDES:
        build_pdf(guide)
        print(f"Wrote {OUTPUT_DIR / guide.filename}")


if __name__ == "__main__":
    main()
