# -*- coding: utf-8 -*-
"""
方案v6：彻底解决水印问题。
关键发现：原始图右下角有半透明"AI生成"水印(x:1537~1854, y:2536~2624)，
需要用alpha>=240的深色才能完全盖住。

策略：
1. 底部渐变带从y=2300开始（水印上方），高度330px
2. 渐变曲线调整：到水印区域(y>=2500)时alpha必须>=240
3. 去掉生硬发光线，靠alpha曲线实现自然过渡
4. 落款文字放在y=2540处，确保完整显示
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630

# 底部渐变带参数
band_top = 2280  # 从水印上方200px开始
band_h = H - band_top  # 350

# 创建渐变叠加层
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)

# 获取渐变带顶部的原始颜色
top_sample = img.getpixel((W // 2, band_top))
deep = (2, 8, 25)

# 关键：到 y=2500（水印起点）时 alpha 需要 >= 245
# band_top=2280, 水印 y=2536, 相对位置=256/350=0.73
# 到 y=2536 时 alpha 应该 >= 250
for y in range(band_h):
    real_y = band_top + y
    progress = y / band_h  # 0.0 ~ 1.0
    
    # 渐变曲线：
    # - 0.0~0.4 (y:2280~2420): 缓慢过渡 alpha 0→80
    # - 0.4~0.65 (y:2420~2508): 中速过渡 alpha 80→245
    # - 0.65~1.0 (y:2508~2630): 高alpha 245→255（完全覆盖水印）
    if progress < 0.4:
        alpha = int(80 * (progress / 0.4) ** 1.8)
    elif progress < 0.65:
        t = (progress - 0.4) / 0.25
        alpha = int(80 + 165 * (t ** 1.2))
    else:
        t = (progress - 0.65) / 0.35
        alpha = int(245 + 10 * t)
    
    alpha = min(255, alpha)
    
    # 颜色从原色 → 深色
    r = int(top_sample[0] + (deep[0] - top_sample[0]) * (alpha / 255))
    g = int(top_sample[1] + (deep[1] - top_sample[1]) * (alpha / 255))
    b = int(top_sample[2] + (deep[2] - top_sample[2]) * (alpha / 255))
    odraw.line([(0, real_y), (W, real_y)], fill=(r, g, b, alpha))

# 合并overlay
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img, "RGBA")

# --- 落款 ---
font_paths = [
    r"C:\Windows\Fonts\msyhbd.ttc",
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
# 放在 y=2545 处，文字高度约64px，底部约2609，离边缘21px
ty = H - 85

# 阴影
draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 160))
# 白色主文字
draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

# 装饰线
line_w = tw + 140
line_x1 = (W - line_w) // 2
line_y = ty - 32
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    alpha = int(220 * (1 - ratio * 0.65))
    draw.point((line_x1 + x, line_y), fill=(0, 200, 230, alpha))
    draw.point((line_x1 + x, line_y + 1), fill=(0, 200, 230, int(alpha * 0.6)))

# 保存
final = img.convert("RGB")
final.save(out, "JPEG", quality=95)

# 验证
check = Image.open(out)
print(f"Saved: {out}")
print(f"Size: {check.size}")

# 检查水印区域像素 - 必须全部是深色
print("\n=== 水印区域像素验证 ===")
all_dark = True
for x, y in [(1550, 2540), (1600, 2550), (1695, 2580), (1750, 2590), (1800, 2600), (1650, 2560), (1700, 2570)]:
    px = check.getpixel((x, y))
    is_light = px[0] > 100 and px[1] > 100 and px[2] > 100
    if is_light:
        all_dark = False
    print(f"  ({x},{y}): RGB={px}  {'<-- 仍浅色!' if is_light else '(深色 OK)'}")

print(f"\nAll dark: {all_dark}")
