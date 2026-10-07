# -*- coding: utf-8 -*-
"""在海报底部添加落款文字，并覆盖右下角AI生成水印"""
from PIL import Image, ImageDraw, ImageFont
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630
draw = ImageDraw.Draw(img, "RGBA")

# --- 1. 底部落款区 ---
# 在底部创建一个半透明渐变条
band_h = 200
band_top = H - band_h
for y in range(band_h):
    alpha = int(200 * (y / band_h) ** 1.5)  # 渐变变暗
    draw.line([(0, band_top + y), (W, band_top + y)], fill=(5, 15, 35, alpha))

# 落款文字
font_paths = [
    r"C:\Windows\Fonts\msyhbd.ttc",    # 微软雅黑 Bold
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 64)
            break
        except:
            continue
if font is None:
    font = ImageFont.load_default()

text = "中国电信汕头分公司"
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (W - tw) // 2
ty = H - band_h + (band_h - th) // 2 - 20

# 文字阴影
draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 150))
# 主文字 - 白色
draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

# 装饰线 - 落款上方
line_w = tw + 120
line_x1 = (W - line_w) // 2
line_x2 = line_x1 + line_w
line_y = ty - 30
# 渐变线（中间亮两边暗）
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    alpha = int(255 * (1 - ratio * 0.7))
    color = (0, 200, 230, alpha)
    draw.point((line_x1 + x, line_y), fill=color)
    draw.point((line_x1 + x, line_y + 1), fill=color)

# --- 2. 精确覆盖右下角"AI生成"水印 ---
# 视觉模型定位：水印区域约 (1675, 2555) ~ (1835, 2610)
# 扩大一点范围确保完全覆盖
wm_x1 = 1650
wm_y1 = 2530
wm_x2 = 1860  # 延伸到右边缘
wm_y2 = 2630  # 延伸到底边缘

# 采样水印上方区域的颜色（未被覆盖的深色底栏区域）
sample_region = img.crop((wm_x1 - 50, wm_y1 - 80, wm_x1 + 100, wm_y1 - 20))
pixels = list(sample_region.getdata())
avg_r = sum(p[0] for p in pixels) // len(pixels)
avg_g = sum(p[1] for p in pixels) // len(pixels)
avg_b = sum(p[2] for p in pixels) // len(pixels)
avg_color = (avg_r, avg_g, avg_b)

# 用渐变覆盖：从上到下逐渐加深，与底栏渐变一致
wm_h = wm_y2 - wm_y1
wm_w = wm_x2 - wm_x1
for y in range(wm_h):
    # 底栏渐变公式: alpha = 200 * (y_in_band / band_h) ** 1.5
    # 水印区域在底栏中的位置
    y_in_band = (wm_y1 + y) - band_top
    base_alpha = int(200 * (y_in_band / band_h) ** 1.5)
    # 混合颜色：底色(5,15,35) * alpha + 原图 * (1-alpha)
    fill_r = int(5 * base_alpha / 255 + avg_r * (1 - base_alpha / 255))
    fill_g = int(15 * base_alpha / 255 + avg_g * (1 - base_alpha / 255))
    fill_b = int(35 * base_alpha / 255 + avg_b * (1 - base_alpha / 255))
    draw.line([(wm_x1, wm_y1 + y), (wm_x2, wm_y1 + y)], fill=(fill_r, fill_g, fill_b, 255))

# 添加细微噪点纹理避免纯色块
import random
random.seed(42)
for i in range(500):
    x = random.randint(wm_x1, wm_x2 - 1)
    y = random.randint(wm_y1, wm_y2 - 1)
    noise = random.randint(-8, 8)
    orig = img.getpixel((x, y))
    new_r = max(0, min(255, orig[0] + noise))
    new_g = max(0, min(255, orig[1] + noise))
    new_b = max(0, min(255, orig[2] + noise))
    draw.point((x, y), fill=(new_r, new_g, new_b, 255))

# 转回RGB保存
final = img.convert("RGB")
final.save(out, "JPEG", quality=95)
print(f"Saved: {out}")
print(f"Size: {final.size}")
