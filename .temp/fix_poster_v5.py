# -*- coding: utf-8 -*-
"""
方案v5：彻底解决右下角水印问题。
水印区域(x:1480~1860, y:2480~2630)在原始图中是一片浅蓝白色区域（云层），
其中叠加了半透明的"AI生成"水印文字。

策略：
1. 将底部扩展渐变带从180px增加到300px，完全覆盖水印区域
2. 渐变带从主图底部颜色平滑过渡到深色，形成自然的暗角效果
3. 落款文字放在渐变带中下方
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630
draw = ImageDraw.Draw(img, "RGBA")

# 水印区域 (x:1480~1860, y:2480~2630)
# 底部渐变带：从 y=2330 开始（水印上方），高度300px，完全覆盖水印
band_top = 2330
band_h = H - band_top  # 300

# 创建渐变叠加层
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)

# 获取渐变带顶部的原始颜色作为起始色
top_sample = img.getpixel((W // 2, band_top))
print(f"Band top color at ({W//2},{band_top}): {top_sample}")

# 生成渐变：从透明 → 深色，越往下越深
for y in range(band_h):
    real_y = band_top + y
    # 渐变曲线：前1/3缓慢渐变，后2/3快速加深
    if y < band_h * 0.3:
        alpha = int(40 * (y / (band_h * 0.3)) ** 1.5)
    else:
        t = (y - band_h * 0.3) / (band_h * 0.7)
        alpha = int(40 + 215 * (t ** 1.5))
    
    # 颜色从原色 → 深色
    deep = (2, 8, 25)
    r = int(top_sample[0] + (deep[0] - top_sample[0]) * (alpha / 255))
    g = int(top_sample[1] + (deep[1] - top_sample[1]) * (alpha / 255))
    b = int(top_sample[2] + (deep[2] - top_sample[2]) * (alpha / 255))
    odraw.line([(0, real_y), (W, real_y)], fill=(r, g, b, alpha))

# 合并overlay
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img, "RGBA")

# 渐变带顶部不做发光线，改用羽化过渡（前20px极低alpha）
# 已在渐变alpha曲线中处理（前30%缓慢渐变），此处不再画发光线

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
# 放在渐变带下半部分，确保完整显示
# band_top=2330, band_h=300, 落款文字高度约64px
# 放在 y=2530 位置，文字底部约2600，离底部边缘30px安全距离
ty = H - 100  # 距底部100px处放置文字顶部

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
print(f"\nSaved: {out}")
print(f"Size: {check.size}")

# 检查水印区域像素
print("\n=== 最终水印区域像素检查 ===")
for x, y in [(1600, 2550), (1695, 2580), (1800, 2600), (1550, 2570), (1750, 2590)]:
    px = check.getpixel((x, y))
    is_light = px[0] > 150 and px[1] > 150 and px[2] > 150
    print(f"  ({x},{y}): RGB={px}  {'<-- 仍浅色!' if is_light else '(已变深 OK)'}")
