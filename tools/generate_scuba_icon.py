from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
OUT = Path(__file__).resolve().parents[1] / "build"
OUT.mkdir(parents=True, exist_ok=True)

image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)

# Soft ocean medallion and rim.
draw.ellipse((54, 54, 970, 970), fill=(3, 45, 68, 255), outline=(119, 236, 239, 255), width=28)
draw.ellipse((88, 88, 936, 936), fill=(5, 105, 130, 255), outline=(4, 31, 49, 255), width=24)

# Bubbles remain readable at medium icon sizes.
for x, y, radius in [(164, 224, 46), (830, 178, 30), (858, 328, 54), (190, 760, 28)]:
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=(129, 238, 242, 55), outline=(194, 255, 255, 220), width=12)
    draw.arc((x-radius+10, y-radius+10, x+radius-10, y+radius-10), 205, 290, fill=(255, 255, 255, 210), width=8)

outline = (40, 28, 17, 255)
brass_dark = (139, 81, 24, 255)
brass = (226, 156, 48, 255)
brass_light = (255, 220, 104, 255)

# Suit collar and shoulders behind the helmet.
draw.rounded_rectangle((212, 702, 812, 910), radius=82, fill=(12, 48, 76, 255), outline=outline, width=24)
draw.polygon([(156, 918), (252, 760), (772, 760), (868, 918)], fill=(18, 68, 99, 255), outline=outline)
draw.line((260, 792, 198, 908), fill=(70, 177, 190, 255), width=22)
draw.line((764, 792, 826, 908), fill=(70, 177, 190, 255), width=22)

# Helmet dome.
draw.ellipse((205, 144, 819, 814), fill=brass_dark, outline=outline, width=30)
draw.ellipse((244, 176, 780, 768), fill=brass, outline=brass_light, width=24)

# Top valve and side air fittings.
draw.rounded_rectangle((424, 96, 600, 220), radius=34, fill=brass, outline=outline, width=22)
draw.rectangle((460, 64, 564, 124), fill=brass_light, outline=outline, width=20)
draw.rounded_rectangle((130, 430, 250, 592), radius=34, fill=brass, outline=outline, width=22)
draw.rounded_rectangle((774, 430, 894, 592), radius=34, fill=brass, outline=outline, width=22)

# Main viewport and glass gradient-like layers.
draw.ellipse((303, 276, 721, 690), fill=(21, 31, 38, 255), outline=outline, width=24)
draw.ellipse((340, 313, 684, 653), fill=(15, 126, 153, 255), outline=(114, 237, 235, 255), width=18)
draw.ellipse((372, 345, 652, 621), fill=(14, 76, 105, 255))
draw.arc((378, 350, 650, 616), 198, 304, fill=(175, 255, 255, 210), width=18)
draw.ellipse((422, 394, 488, 460), fill=(225, 255, 255, 110))

# Eight large helmet bolts.
for x, y in [(292, 277), (512, 232), (732, 277), (770, 500), (716, 704), (512, 758), (308, 704), (254, 500)]:
    draw.ellipse((x-28, y-28, x+28, y+28), fill=brass_light, outline=outline, width=10)
    draw.line((x-11, y, x+11, y), fill=brass_dark, width=7)

# Lower grill and central clasp.
draw.rounded_rectangle((382, 682, 642, 802), radius=32, fill=brass_dark, outline=outline, width=20)
for y in (714, 748, 782):
    draw.line((420, y, 604, y), fill=brass_light, width=12)
draw.ellipse((476, 802, 548, 874), fill=brass_light, outline=outline, width=12)

# Gentle highlight without blurring the silhouette.
highlight = Image.new("RGBA", image.size, (0, 0, 0, 0))
hd = ImageDraw.Draw(highlight)
hd.arc((264, 188, 760, 746), 194, 282, fill=(255, 245, 179, 135), width=18)
highlight = highlight.filter(ImageFilter.GaussianBlur(2))
image = Image.alpha_composite(image, highlight)

png_path = OUT / "scuba-diver-helmet.png"
ico_path = OUT / "scuba-diver-helmet.ico"
image.save(png_path, optimize=True)
image.save(ico_path, format="ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(png_path)
print(ico_path)
