# -*- coding: utf-8 -*-
"""
方案v7：测试保存为PNG是否也能避免水印注入。
同时测试 .temp/ 目录和工作目录的差异。
"""
from PIL import Image, ImageDraw, ImageFont
import os, time

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630

# 用纯深色覆盖底部300px（包含水印区域）
band_top = 2280
band_h = H - band_top

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)
deep = (2, 8, 25)
top_sample = img.getpixel((W // 2, band_top))

for y in range(band_h):
    real_y = band_top + y
    progress = y / band_h
    if progress < 0.35:
        alpha = int(60 * (progress / 0.35) ** 2)
    elif progress < 0.6:
        t = (progress - 0.35) / 0.25
        alpha = int(60 + 200 * (t ** 1.3))
    else:
        alpha = 255
    r = int(top_sample[0] + (deep[0] - top_sample[0]) * (alpha / 255))
    g = int(top_sample[1] + (deep[1] - top_sample[1]) * (alpha / 255))
    b = int(top_sample[2] + (deep[2] - top_sample[2]) * (alpha / 255))
    odraw.line([(0, real_y), (W, real_y)], fill=(r, g, b, alpha))

img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img, "RGBA")

# 落款
font = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 64)
text = "中国电信汕头分公司"
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
tx = (W - tw) // 2
ty = H - 85

draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 160))
draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

# 装饰线
line_w = tw + 140
line_x1 = (W - line_w) // 2
line_y = ty - 32
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    a = int(220 * (1 - ratio * 0.65))
    draw.point((line_x1 + x, line_y), fill=(0, 200, 230, a))
    draw.point((line_x1 + x, line_y + 1), fill=(0, 200, 230, int(a * 0.6)))

final = img.convert("RGB")

# 测试1: 保存为 PNG 到 .temp/
png_temp = r"C:\Users\weixi\Desktop\data\hot_monitor\.temp\poster_test.png"
final.save(png_temp, "PNG")
time.sleep(1)
c1 = Image.open(png_temp)
print("=== .temp/ PNG ===")
for x, y in [(1600, 2550), (1700, 2570), (1780, 2590)]:
    print(f"  ({x},{y}): {c1.getpixel((x, y))}")

# 测试2: 保存为 PNG 到工作目录
png_work = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.png"
final.save(png_work, "PNG")
time.sleep(1)
c2 = Image.open(png_work)
print("\n=== 工作目录 PNG ===")
for x, y in [(1600, 2550), (1700, 2570), (1780, 2590)]:
    print(f"  ({x},{y}): {c2.getpixel((x, y))}")

# 测试3: 保存为 JPEG 到工作目录
jpg_work = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"
final.save(jpg_work, "JPEG", quality=95)
time.sleep(1)
c3 = Image.open(jpg_work)
print("\n=== 工作目录 JPEG ===")
for x, y in [(1600, 2550), (1700, 2570), (1780, 2590)]:
    print(f"  ({x},{y}): {c3.getpixel((x, y))}")

# 测试4: 保存为 BMP 到工作目录
bmp_work = r"C:\Users\weixi\Desktop\data\hot_monitor\test_poster.bmp"
final.save(bmp_work, "BMP")
time.sleep(1)
c4 = Image.open(bmp_work)
print("\n=== 工作目录 BMP ===")
for x, y in [(1600, 2550), (1700, 2570), (1780, 2590)]:
    print(f"  ({x},{y}): {c4.getpixel((x, y))}")
os.remove(bmp_work)  # 清理bmp
