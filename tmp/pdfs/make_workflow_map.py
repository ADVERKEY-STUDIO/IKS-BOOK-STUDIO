from math import atan2, cos, sin, pi
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A0, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path("/Users/gaurav/IKS-Book-Studio-Local-v84")
OUTPUT = ROOT / "output/pdf/iks-book-studio-workflow-map.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = landscape(A0)
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#526076")
BORDER = colors.HexColor("#8A99AD")
LINE = colors.HexColor("#475569")
PANEL = colors.HexColor("#F8FAFC")
BLUE = colors.HexColor("#EAF3FF")
GREEN = colors.HexColor("#EBF8F0")
AMBER = colors.HexColor("#FFF6DB")
PURPLE = colors.HexColor("#F4EEFF")
WHITE = colors.white

c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H), pageCompression=1)
c.setTitle("IKS Book Studio - Website Workflow Map")
c.setAuthor("IKS Book Studio")

body_style = ParagraphStyle(
    "node",
    fontName="Helvetica",
    fontSize=18,
    leading=22,
    textColor=INK,
    alignment=TA_CENTER,
)
small_style = ParagraphStyle(
    "small-node",
    parent=body_style,
    fontSize=15,
    leading=18,
)


def page_background():
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def section(x, y, w, h, title, accent):
    c.setFillColor(PANEL)
    c.setStrokeColor(BORDER)
    c.setLineWidth(2)
    c.roundRect(x, y, w, h, 22, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 62, w, 62, 22, fill=1, stroke=0)
    c.rect(x, y + h - 62, w, 31, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(x + 28, y + h - 40, title)


def node(x, y, w, h, text, fill=WHITE, stroke=BORDER, font_size=18, radius=16):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(2)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    style = body_style if font_size >= 18 else small_style
    p = Paragraph(text, style)
    pw, ph = p.wrap(w - 24, h - 16)
    p.drawOn(c, x + 12, y + (h - ph) / 2)
    return (x, y, w, h)


def decision(x, y, w, h, text):
    points = [(x + w / 2, y + h), (x + w, y + h / 2), (x + w / 2, y), (x, y + h / 2)]
    path = c.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    path.close()
    c.setFillColor(AMBER)
    c.setStrokeColor(colors.HexColor("#B68A26"))
    c.setLineWidth(2)
    c.drawPath(path, fill=1, stroke=1)
    p = Paragraph(text, body_style)
    pw, ph = p.wrap(w * 0.62, h * 0.55)
    p.drawOn(c, x + (w - pw) / 2, y + (h - ph) / 2)
    return (x, y, w, h)


def center_top(box):
    x, y, w, h = box
    return x + w / 2, y + h


def center_bottom(box):
    x, y, w, h = box
    return x + w / 2, y


def center_left(box):
    x, y, w, h = box
    return x, y + h / 2


def center_right(box):
    x, y, w, h = box
    return x + w, y + h / 2


def arrow(start, end, label=None, label_dx=0, label_dy=0, width=3):
    x1, y1 = start
    x2, y2 = end
    angle = atan2(y2 - y1, x2 - x1)
    head = 14
    c.setStrokeColor(LINE)
    c.setFillColor(LINE)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    p1 = (x2 - head * cos(angle - pi / 7), y2 - head * sin(angle - pi / 7))
    p2 = (x2 - head * cos(angle + pi / 7), y2 - head * sin(angle + pi / 7))
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(*p1)
    path.lineTo(*p2)
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    if label:
        mx = (x1 + x2) / 2 + label_dx
        my = (y1 + y2) / 2 + label_dy
        tw = stringWidth(label, "Helvetica-Bold", 14)
        c.setFillColor(WHITE)
        c.rect(mx - tw / 2 - 8, my - 9, tw + 16, 20, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(mx, my - 3, label)


def poly_arrow(points, label=None, label_at=None):
    c.setStrokeColor(LINE)
    c.setLineWidth(3)
    path = c.beginPath()
    path.moveTo(*points[0])
    for point in points[1:]:
        path.lineTo(*point)
    c.drawPath(path, fill=0, stroke=1)
    arrow(points[-2], points[-1], width=0.01)
    if label and label_at:
        c.setFillColor(WHITE)
        tw = stringWidth(label, "Helvetica-Bold", 14)
        c.rect(label_at[0] - tw / 2 - 8, label_at[1] - 9, tw + 16, 20, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(label_at[0], label_at[1] - 3, label)


page_background()
c.setFillColor(INK)
c.setFont("Helvetica-Bold", 34)
c.drawCentredString(PAGE_W / 2, PAGE_H - 70, "IKS Book Studio - Complete Website Workflow")
c.setFillColor(MUTED)
c.setFont("Helvetica", 18)
c.drawCentredString(PAGE_W / 2, PAGE_H - 102, "From source selection and AI adaptation to editorial review, design and publishing")

# Entry workflow
open_box = node(PAGE_W / 2 - 230, PAGE_H - 210, 460, 72, "User opens IKS Book Studio", BLUE)
dashboard = node(PAGE_W / 2 - 230, PAGE_H - 320, 460, 72, "Dashboard", WHITE)
choice = decision(PAGE_W / 2 - 245, PAGE_H - 465, 490, 102, "Open existing or create new?")
wizard = node(PAGE_W / 2 - 310, PAGE_H - 585, 620, 76, "Four-step setup: Source - Reader - Design - Review", WHITE)
mode = decision(PAGE_W / 2 - 235, PAGE_H - 735, 470, 104, "Creation method")
arrow(center_bottom(open_box), center_top(dashboard))
arrow(center_bottom(dashboard), center_top(choice))
arrow(center_bottom(choice), center_top(wizard), "New")
arrow(center_bottom(wizard), center_top(mode))

# Existing project shortcut
existing = node(PAGE_W / 2 + 610, PAGE_H - 440, 480, 72, "Load existing project from D1", WHITE)
arrow(center_right(choice), center_left(existing), "Existing", label_dy=18)

# Branch panels
external_x, external_y, external_w, external_h = 70, 720, 940, 950
auto_x, auto_y, auto_w, auto_h = 1050, 600, PAGE_W - 1120, 1070
section(external_x, external_y, external_w, external_h, "Recommended external-AI workflow", BLUE)
section(auto_x, auto_y, auto_w, auto_h, "Advanced automatic workflow", GREEN)

# Branch connections from decision
poly_arrow([center_left(mode), (external_x + external_w / 2, center_left(mode)[1]), (external_x + external_w / 2, external_y + external_h - 90)], "ChatGPT / Claude / DeepSeek", (external_x + external_w / 2, center_left(mode)[1] + 18))
poly_arrow([center_right(mode), (auto_x + auto_w / 2, center_right(mode)[1]), (auto_x + auto_w / 2, auto_y + auto_h - 90)], "Automatic", (auto_x + auto_w / 2, center_right(mode)[1] + 18))

# External branch nodes
ext_nodes = []
ext_labels = [
    "Generate a custom manuscript prompt",
    "User uploads the source directly to the chosen external AI",
    "AI produces a Markdown manuscript or ZIP",
    "Import or paste the completed manuscript",
    "Validate chapter order, headings, content and image references",
    "Convert valid sections into approved chapters",
]
ey = external_y + external_h - 180
for index, label in enumerate(ext_labels):
    fill = BLUE if index in (0, 5) else WHITE
    box = node(external_x + 105, ey - index * 125, external_w - 210, 78, label, fill, font_size=18)
    ext_nodes.append(box)
for first, second in zip(ext_nodes, ext_nodes[1:]):
    arrow(center_bottom(first), center_top(second))
poly_arrow([center_left(ext_nodes[4]), (external_x + 45, center_left(ext_nodes[4])[1]), (external_x + 45, center_left(ext_nodes[3])[1]), center_left(ext_nodes[3])], "Problems found", (external_x + 120, (center_left(ext_nodes[4])[1] + center_left(ext_nodes[3])[1]) / 2))

# Automatic branch nodes arranged in two columns
col1_x = auto_x + 65
col2_x = auto_x + auto_w / 2 + 20
node_w = auto_w / 2 - 100
row_y = [auto_y + auto_h - 180 - i * 125 for i in range(7)]

upload = node(col1_x, row_y[0], node_w, 78, "Upload PDF, DOCX, TXT or Markdown", GREEN)
store = node(col1_x, row_y[1], node_w, 78, "Store source or resumable chunks in R2", WHITE)
classify = node(col1_x, row_y[2], node_w, 78, "Extract text and classify the source", WHITE)
searchable = decision(col1_x + 45, row_y[3] - 4, node_w - 90, 90, "Searchable source?")
detect = node(col1_x, row_y[4], node_w, 78, "Detect headings, terms and source-page ranges", WHITE)
plan = node(col1_x, row_y[5], node_w, 78, "Create source-aware chapter plan", GREEN)
confirm = node(col1_x, row_y[6], node_w, 78, "Recommend pages, infer book persona and confirm plan", WHITE)

chunks = node(col2_x, row_y[3], node_w, 78, "Split scanned PDF into resumable chunks", WHITE)
ocr = node(col2_x, row_y[4], node_w, 78, "OCR each chunk through OpenRouter and cache results", WHITE)
outline = node(col2_x, row_y[5], node_w, 78, "Detect Parts, chapters and physical page ranges", WHITE)
review = node(col2_x, row_y[6], node_w, 78, "Human reviews and confirms the outline", GREEN)

for first, second in [(upload, store), (store, classify), (classify, searchable), (detect, plan), (plan, confirm), (chunks, ocr), (ocr, outline), (outline, review)]:
    arrow(center_bottom(first), center_top(second))
arrow(center_bottom(searchable), center_top(detect), "Yes", label_dx=-30)
arrow(center_right(searchable), center_left(chunks), "Scanned / mixed", label_dy=18)
poly_arrow([center_bottom(review), (center_bottom(review)[0], auto_y + 70), (center_bottom(plan)[0], auto_y + 70), center_bottom(plan)], "Verified outline", ((center_bottom(review)[0] + center_bottom(plan)[0]) / 2, auto_y + 88))

# Generation strip inside the automatic panel
gen_y = auto_y + 45
gen_x = col1_x + node_w + 45
gen_w = auto_w - (gen_x - auto_x) - 60
generation = node(gen_x, gen_y, gen_w, 92, "Book brief -> Generate Chapter 1 -> Local quality gate -> Up to three targeted passes -> Save -> Generate remaining chapters two at a time", PURPLE, font_size=18)
poly_arrow([center_bottom(confirm), (center_bottom(confirm)[0], gen_y + 46), center_left(generation)])

# Convergence and editorial workflow
editor_y = 470
editor = node(PAGE_W / 2 - 260, editor_y, 520, 82, "Editorial studio", PURPLE)
poly_arrow([center_bottom(ext_nodes[-1]), (center_bottom(ext_nodes[-1])[0], editor_y + 41), center_left(editor)])
poly_arrow([center_bottom(generation), (center_bottom(generation)[0], editor_y + 41), center_right(editor)])
poly_arrow([center_bottom(existing), (center_bottom(existing)[0], editor_y + 130), (center_right(editor)[0], editor_y + 130), center_right(editor)])

section(250, 120, PAGE_W - 500, 300, "Editorial, design and publishing", PURPLE)
edit = node(330, 245, 460, 76, "Edit chapter text and page allocation", WHITE, font_size=15)
chapter_decision = decision(855, 235, 390, 96, "Chapter decision")
repair = node(1315, 300, 410, 70, "Repair with focused AI feedback", WHITE, font_size=15)
approve = node(1315, 205, 410, 70, "Approve or approve manually", WHITE, font_size=15)
handoff = node(1315, 110, 410, 70, "Designer handoff", WHITE, font_size=15)
designer = node(1800, 235, 430, 82, "Illustrations and Designer Studio", BLUE, font_size=15)
preview = node(2295, 235, 360, 82, "Preview complete book", WHITE, font_size=15)
pdf = node(2735, 320, 260, 68, "PDF", GREEN)
docx = node(2735, 235, 260, 68, "DOCX", GREEN)
canva = node(2735, 150, 260, 68, "Canva return", GREEN)
package = node(2735, 65, 260, 68, "ChatGPT ZIP", GREEN)

arrow(center_right(edit), center_left(chapter_decision))
arrow(center_right(chapter_decision), center_left(repair), "Improve", label_dy=18)
arrow(center_right(chapter_decision), center_left(approve), "Pass")
arrow(center_right(chapter_decision), center_left(handoff), "Human design", label_dy=-18)
poly_arrow([center_bottom(repair), (center_bottom(repair)[0], 205), (center_right(edit)[0], 205), center_right(edit)], "Review again", (1050, 220))
arrow(center_right(approve), center_left(designer))
arrow(center_right(handoff), center_left(designer))
arrow(center_right(designer), center_left(preview))
for output in (pdf, docx, canva, package):
    arrow(center_right(preview), center_left(output))

# Small persistence legend
c.setFillColor(MUTED)
c.setFont("Helvetica", 15)
c.drawString(320, 145, "Persistent services:")
c.setFont("Helvetica-Bold", 15)
c.drawString(465, 145, "D1 - projects, versions, preferences    R2 - sources, OCR chunks, images    OpenRouter - OCR and chapter generation")

c.setFillColor(MUTED)
c.setFont("Helvetica", 13)
c.drawRightString(PAGE_W - 55, 35, "White-background workflow map - generated from the implemented project code")

c.showPage()
c.save()
print(OUTPUT)
