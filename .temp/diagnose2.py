# -*- coding: utf-8 -*-
"""
诊断脚本2：直接把右下角 1400~1860, 2480~2630 区域全部涂成纯深蓝色，
保存后检查是否还有水印。以此判断水印是来自原始图还是保存hook注入。
"""
from PIL import Image, ImageDraw

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\.temp\test_solid_cover.jpg"

img = Image.open(src).convert("RGB")
W, H = img.size
draw = ImageDraw.Draw(img)

# 用纯深蓝色覆盖右下角大区域
draw.rectangle([1400, 2450, 1860, 2630], fill=(2, 8, 25))

# 保存到 .temp/
img.save(out, "JPEG", quality=95)

# 检查
check = Image.open(out)
print(f"Size: {check.size}")
print("\n=== 纯色覆盖后检查 ===")
for x, y in [(1500, 2500), (1600, 2550), (1695, 2580), (1750, 2590), (1800, 2600)]:
    px = check.getpixel((x, y))
    print(f"  ({x},{y}): RGB={px}")
