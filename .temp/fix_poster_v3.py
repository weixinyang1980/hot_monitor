# -*- coding: utf-8 -*-
"""
方案v3：不裁剪，而是用周边像素克隆法精确覆盖水印区域。
1. 水印位于 x:1537~1854, y:2536~2624
2. 用水印正上方和左侧的干净区域像素，克隆覆盖水印
3. 然后在右下角添加落款
"""
from PIL import Image, ImageDraw, ImageFont
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630
draw = ImageDraw.Draw(img, "RGBA")

# 水印区域（加大一点边距确保完全覆盖）
wm_x1 = 1525
wm_y1 = 2525
wm_x2 = 1860
wm_y2 = 2630
wm_w = wm_x2 - wm_x1  # 335
wm_h = wm_y2 - wm_y1  # 105

# 策略：取水印正上方相同宽度的区域(y偏移往上120px)，按行往下复制
offset = 120  # 往上取120像素的干净区域
src_y1 = wm_y1 - offset
src_y2 = wm_y1

# 逐行复制：从上方干净区域取对应列的像素，写入水印区域
for y in range(wm_h):
    src_y = src_y1 + y
    if src_y >= 0 and src_y < H:
        row_pixels = []
        for x in range(wm_x1, wm_x2):
            row_pixels.append(img.getpixel((x, src_y)))
        for x in range(wm_w):
            draw.point((wm_x1 + x, wm_y1 + y), fill=row_pixels[x])

# 对覆盖区域做轻微模糊，让克隆痕迹更自然
from PIL import ImageFilter
# 取出覆盖区域，轻微模糊后贴回
patch = img.crop((wm_x1, wm_y1, wm_x2, wm_y2))
patch_blurred = patch.filter(ImageFilter.GaussianBlur(radius=1.5))
img.paste(patch_blurred, (wm_x1, wm_y1))
draw = ImageDraw.Draw(img, "RGBA")  # 重新获取draw对象

# --- 底部落款 ---
# 检查底部是否有足够深色区域来放文字，如果没有则加渐变
band_h = 180
band_top = H - band_h

# 创建底部渐变带
for y in range(band_h):
    alpha = int(220 * (y / band_h) ** 1.8)
    draw.line([(0, band_top + y), (W, band_top + y)], fill=(3, 10, 28, alpha))

# 落款字体
font_paths = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 62)
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
ty = H - band_h + (band_h - th) // 2 - 15

# 阴影
draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0, 160))
# 白色文字
draw.text((tx, ty), text, font=font, fill=(255, 255, 255, 255))

# 装饰线
line_w = tw + 140
line_x1 = (W - line_w) // 2
line_y = ty - 28
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    alpha = int(220 * (1 - ratio * 0.65))
    draw.point((line_x1 + x, line_y), fill=(0, 200, 230, alpha))
    draw.point((line_x1 + x, line_y + 1), fill=(0, 200, 230, int(alpha * 0.6)))

# 青色发光线在渐变带顶部
glow_y = band_top - 1
for offset_g in range(-2, 3):
    alpha = max(0, 100 - abs(offset_g) * 30)
    draw.line([(0, glow_y + offset_g), (W, glow_y + offset_g)], fill=(0, 200, 230, alpha))

final = img.convert("RGB")
final.save(out, "JPEG", quality=95)
print(f"Saved: {out}")
print(f"Size: {final.size}")
