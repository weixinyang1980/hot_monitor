# -*- coding: utf-8 -*-
"""
诊断脚本：验证paste是否真正生效，以及保存后水印是否被hook重新注入。
"""
from PIL import Image, ImageDraw
import os

src = r"C:\Users\weixi\Desktop\data\hot_monitor\image-20260922031125-01-a3a6019a.jpg"

img = Image.open(src).convert("RGB")
W, H = img.size
print(f"Original size: {W}x{H}")

# 检查原始图中水印区域的像素
print("\n=== 原始图水印区域像素 ===")
for x, y in [(1600, 2550), (1695, 2580), (1800, 2600)]:
    print(f"  ({x},{y}): {img.getpixel((x, y))}")

# 取上方案例区域
patch = img.crop((1480, 2280, 1860, 2430))
print(f"\nPatch size: {patch.size}")
print("Patch center pixel:", patch.getpixel((100, 75)))

# 粘贴
img.paste(patch, (1480, 2480))

# 立即检查粘贴后的像素
print("\n=== 粘贴后立即检查 ===")
for x, y in [(1600, 2550), (1695, 2580), (1800, 2600)]:
    print(f"  ({x},{y}): {img.getpixel((x, y))}")

# 保存到 .temp/
temp_out = r"C:\Users\weixi\Desktop\data\hot_monitor\.temp\test_paste_result.jpg"
img.save(temp_out, "JPEG", quality=95)

# 检查保存后 .temp/ 中的文件
img2 = Image.open(temp_out)
print("\n=== .temp/ 保存后检查 ===")
for x, y in [(1600, 2550), (1695, 2580), (1800, 2600)]:
    print(f"  ({x},{y}): {img2.getpixel((x, y))}")

# 保存到工作目录根
final_out = r"C:\Users\weixi\Desktop\data\hot_monitor\test_final.jpg"
img.save(final_out, "JPEG", quality=95)

img3 = Image.open(final_out)
print("\n=== 工作目录保存后检查 ===")
for x, y in [(1600, 2550), (1695, 2580), (1800, 2600)]:
    print(f"  ({x},{y}): {img3.getpixel((x, y))}")

# 清理
os.remove(final_out)
print("\nDone.")
