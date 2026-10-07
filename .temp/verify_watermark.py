# -*- coding: utf-8 -*-
"""
验证方案：检查最终文件中水印区域的实际像素值，
同时把右下角区域裁出来单独保存到 .temp 验证。
"""
from PIL import Image

# 检查已保存的输出文件
out = r"C:\Users\weixi\Desktop\data\hot_monitor\企业形象品牌焕新海报.jpg"
img = Image.open(out)
W, H = img.size
print(f"Image size: {W}x{H}")

# 检查水印区域多个点的像素值
# 水印应该在 x:1537~1854, y:2536~2624
check_points = [
    (1600, 2550),  # 水印左上
    (1695, 2580),  # 水印中心
    (1800, 2600),  # 水印右下
    (1550, 2570),  # 水印左中
    (1750, 2590),  # 水印右中
    (1650, 2560),  # 水印中上
]

print("\n=== 水印区域像素检查 ===")
for x, y in check_points:
    px = img.getpixel((x, y))
    is_light = px[0] > 150 and px[1] > 150 and px[2] > 150
    print(f"  ({x},{y}): RGB={px}  {'<-- 浅色/可能水印' if is_light else '(正常深色)'}")

# 裁出右下角400x300区域单独保存
crop = img.crop((W-400, H-300, W, H))
crop_path = r"C:\Users\weixi\Desktop\data\hot_monitor\.temp\bottom_right_crop.jpg"
crop.save(crop_path, "JPEG", quality=95)
print(f"\nBottom-right crop saved to: {crop_path}")
print(f"Crop size: {crop.size}")

# 同时保存到 .temp 目录的全图副本
temp_copy = r"C:\Users\weixi\Desktop\data\hot_monitor\.temp\poster_temp_copy.jpg"
img.save(temp_copy, "JPEG", quality=95)
print(f"Temp copy saved to: {temp_copy}")
