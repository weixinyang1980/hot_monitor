# -*- coding: utf-8 -*-
"""
从原始海报图中裁掉底部含水印区域，
用原图底部上方的干净像素重新拼接一个干净的底栏（含渐变+落款）。
"""
from PIL import Image, ImageDraw, ImageFont
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"

img = Image.open(src).convert("RGBA")
W, H = img.size  # 1860 x 2630

# 水印在底部约 y=2530~2610 范围
# 裁掉底部 150 像素（含水印），从上方干净区域取材重建
cut_h = 150
keep_h = H - cut_h  # 2480

# 裁出不含水印的主体
main_body = img.crop((0, 0, W, keep_h))

# 从 keep_h 上方取一段干净底栏素材（60px高），拉伸作为新底栏背景
band_src = img.crop((0, keep_h - 80, W, keep_h))
band_src_pixels = band_src.load()

# 创建新底栏：180px 高，渐变变暗
new_band_h = 180
new_img = Image.new("RGBA", (W, keep_h + new_band_h), (0, 0, 0, 0))
new_img.paste(main_body, (0, 0))

draw = ImageDraw.Draw(new_img, "RGBA")

# 画底栏渐变：从主图底部颜色渐变到深色
top_color = band_src_pixels[0, 40]  # 取中间行的颜色作为起始
deep_color = (3, 10, 28)  # 最底部颜色

for y in range(new_band_h):
    ratio = y / new_band_h
    r = int(top_color[0] + (deep_color[0] - top_color[0]) * ratio)
    g = int(top_color[1] + (deep_color[1] - top_color[1]) * ratio)
    b = int(top_color[2] + (deep_color[2] - top_color[2]) * ratio)
    draw.line([(0, keep_h + y), (W, keep_h + y)], fill=(r, g, b, 255))

# 在主图与新底栏衔接处画一条柔和的青色发光线
glow_y = keep_h - 1
for offset in range(-3, 4):
    alpha = max(0, 180 - abs(offset) * 50)
    draw.line([(0, glow_y + offset), (W, glow_y + offset)], fill=(0, 200, 230, alpha))

# --- 落款文字 ---
font_paths = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]
font_big = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font_big = ImageFont.truetype(fp, 62)
            break
        except:
            continue
if font_big is None:
    font_big = ImageFont.load_default()

text = "中国电信汕头分公司"
bbox = draw.textbbox((0, 0), text, font=font_big)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
tx = (W - tw) // 2
ty = keep_h + (new_band_h - th) // 2 - 15

# 文字阴影
draw.text((tx + 2, ty + 2), text, font=font_big, fill=(0, 0, 0, 160))
# 主文字
draw.text((tx, ty), text, font=font_big, fill=(255, 255, 255, 255))

# 落款上方装饰线（渐变青色）
line_w = tw + 140
line_x1 = (W - line_w) // 2
line_y = ty - 28
for x in range(line_w):
    ratio = abs(x - line_w / 2) / (line_w / 2)
    alpha = int(220 * (1 - ratio * 0.65))
    draw.point((line_x1 + x, line_y), fill=(0, 200, 230, alpha))
    draw.point((line_x1 + x, line_y + 1), fill=(0, 200, 230, int(alpha * 0.6)))

# 转回RGB保存
final = new_img.convert("RGB")
final.save(out, "JPEG", quality=95)
print(f"Saved: {out}")
print(f"Original size: {W}x{H}")
print(f"Final size: {final.size}")
