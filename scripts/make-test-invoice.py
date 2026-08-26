"""
Generate a simple test invoice image (PNG) for OCR testing.
The image will contain a basic invoice layout that GLM-4V should be able to parse.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 800, 600
img = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(img)

# Try to load a TrueType font
try:
    font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
    font_med = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    font_body = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
except:
    font_title = ImageFont.load_default()
    font_med = ImageFont.load_default()
    font_body = ImageFont.load_default()

# Title
draw.text((40, 30), "ACME CORPORATION", fill='black', font=font_title)
draw.text((40, 65), "123 Business St, Cairo, Egypt", fill='black', font=font_body)
draw.text((40, 85), "Tax ID: 123-456-789", fill='black', font=font_body)

# Invoice header
draw.text((40, 140), "INVOICE #INV-2026-001", fill='black', font=font_med)
draw.text((40, 170), "Date: 2026-08-26", fill='black', font=font_body)
draw.text((40, 190), "Due: 2026-09-26", fill='black', font=font_body)

# Bill To
draw.text((40, 230), "BILL TO:", fill='black', font=font_med)
draw.text((40, 255), "Northwind Trading", fill='black', font=font_body)
draw.text((40, 275), "456 Commerce Ave", fill='black', font=font_body)

# Items
draw.text((40, 320), "DESCRIPTION                QTY    PRICE    AMOUNT", fill='black', font=font_body)
draw.line([(40, 340), (760, 340)], fill='black', width=1)
draw.text((40, 350), "Office Supplies             10     25.00    250.00", fill='black', font=font_body)
draw.text((40, 375), "Printer Paper              5     15.00     75.00", fill='black', font=font_body)
draw.text((40, 400), "Ink Cartridges              3     40.00    120.00", fill='black', font=font_body)

# Totals
draw.line([(40, 440), (760, 440)], fill='black', width=1)
draw.text((500, 460), "Subtotal:        445.00", fill='black', font=font_body)
draw.text((500, 485), "Tax (14%):        62.30", fill='black', font=font_body)
draw.text((500, 515), "TOTAL:          507.30", fill='black', font=font_med)

out = "/home/z/my-project/scripts/test-invoice.png"
img.save(out)
print(f"Saved test invoice: {out}")
print(f"Size: {os.path.getsize(out)} bytes")
