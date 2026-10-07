# -*- coding: utf-8 -*-
"""
方案v4：用ImageData批量像素操作替代逐像素getpixel/point，
确保修改真正写入图像。并增大覆盖区域到水印+周围50px缓冲。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGB")
W, H = img.size  # 1860 x 2630

# 水印区域：x:1537~1854, y:2536~2624，加50px缓冲
wm_x1 = 1480
wm_y1 = 2480
wm_x2 = 1860
wm_y2 = 2630
wm_w = wm_x2 - wm_x1  # 380
wm_h = wm_y2 - wm_y1  # 150

# 取上方干净区域（偏移往上200px）
offset = 200
src_y1 = wm_y1 - offset  # 2280
src_y2 = src_y1 + wm_h    # 2430

# 用crop+paste直接替换水印区域
clean_patch = img.crop((wm_x1, src_y1, wm_x2, src_y2))
# 轻微模糊
clean_patch_blurred = clean_patch.filter(ImageFilter.GaussianBlur(radius=2.0))
img.paste(clean_patch_blurred, (wm_x1, wm_y1))

# 确认修改已写入 - 重新操作
draw = ImageDraw.Draw(img)

# --- 底部落款区 ---
band_h = 180
band_top = H - band_h

# 创建半透明渐变叠加层
overlay = Image.new("RGBA", (W, band_h), (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)
for y in range(band_h):
    alpha = int(230 * (y / band_h) ** 1.8)
    odraw.line([(0, y), (W, y)], fill=(3, 10, 28, alpha))

# 将overlay合并到主图
img_rgba = img.convert("RGBA")
# 创建全尺寸overlay
full_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
full_overlay.paste(overlay, (0, band_top))
img_rgba = Image.alpha_composite(img_rgba, full_overlay)
img = img_rgba.convert("RGB")
draw = ImageDraw.Draw(img)

# 落款文字
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
draw.text((tx + 2, ty + 2), text, font=font, fill=(0, 0, 0))
# 白色文字
draw.text((tx, ty), text, font=font, fill=(255, 255, 255))

# 装饰线
line_w = tw + 140
line_x1 = (W - line_w) // 2
line_y = ty - 28
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    alpha = int(220 * (1 - ratio * 0.65))
    r, g, b = 0, 200, 230
    # 混合到主图
    orig = img.getpixel((line_x1 + x, line_y))
    nr = int(r * alpha / 255 + orig[0] * (1 - alpha / 255))
    ng = int(g * alpha / 255 + orig[1] * (1 - alpha / 255))
    nb = int(b * alpha / 255 + orig[2] * (1 - alpha / 255))
    draw.point((line_x1 + x, line_y), fill=(nr, ng, nb))
    orig2 = img.getpixel((line_x1 + x, line_y + 1))
    a2 = int(alpha * 0.6)
    nr2 = int(r * a2 / 255 + orig2[0] * (1 - a2 / 255))
    ng2 = int(g * a2 / 255 + orig2[1] * (1 - a2 / 255))
    nb2 = int(b * a2 / 255 + orig2[2] * (1 - a2 / 255))
    draw.point((line_x1 + x, line_y + 1), fill=(nr2, ng2, nb2))

# 保存
img.save(out, "JPEG", quality=95)

# 验证：检查水印区域像素是否已改变
check_img = Image.open(out)
# 检查水印中心点(1695, 2580)是否还是原来的浅灰色
center_pixel = check_img.getpixel((1695, 2580))
print(f"Saved: {out}")
print(f"Size: {check_img.size}")
print(f"Watermark center pixel (1695,2580): {center_pixel}")
print(f"If pixel is dark blue-ish, watermark is covered. If light gray, watermark remains.")
