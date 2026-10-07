# 在海报右下角绘制单一干净的「AI生成」标识，覆盖原有叠层水印区域
Add-Type -AssemblyName System.Drawing

$root = "C:\Users\weixi\Desktop\data\hot_monitor"
$srcPath = Join-Path $root "电信奋斗者文化海报-A4竖版.jpg"
$outPath = Join-Path $root ".temp\poster-clean-corner.jpg"

$src = [System.Drawing.Image]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height
$bmp = New-Object System.Drawing.Bitmap($src, $w, $h)
$src.Dispose()

$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# 文字与字体
$text = "AI生成"
$font = New-Object System.Drawing.Font("Microsoft YaHei", 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fsize = $g.MeasureString($text, $font)
$padX = 18
$padY = 10
$boxW = [int]($fsize.Width + $padX * 2)
$boxH = [int]($fsize.Height + $padY * 2)
$margin = 46
$boxX = $w - $boxW - $margin
$boxY = $h - $boxH - $margin

# 半透明深蓝底圆角框（覆盖旧叠层水印区域）
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 40, 60, 90))
$r = 14
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$gp.AddArc($boxX, $boxY, ($r * 2), ($r * 2), 180, 90)
$gp.AddArc(($boxX + $boxW - $r * 2), $boxY, ($r * 2), ($r * 2), 270, 90)
$gp.AddArc(($boxX + $boxW - $r * 2), ($boxY + $boxH - $r * 2), ($r * 2), ($r * 2), 0, 90)
$gp.AddArc($boxX, ($boxY + $boxH - $r * 2), ($r * 2), ($r * 2), 90, 90)
$gp.CloseFigure()
$g.FillPath($bgBrush, $gp)

# 单层白色半透明文字
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
$textRect = New-Object System.Drawing.RectangleF(($boxX + $padX), ($boxY + $padY - 2), $fsize.Width, $fsize.Height)
$g.DrawString($text, $font, $textBrush, $textRect)

$g.Dispose()

# 以 JPEG 95% 质量输出
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]95)
$bmp.Save($outPath, $codec, $ep)
$bmp.Dispose()
$gp.Dispose()

Write-Output "完成：$outPath ($($w)x$($h))"
