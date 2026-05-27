Add-Type -AssemblyName System.Drawing

$sourcePng = Join-Path $PSScriptRoot "..\build\icon.png"
$destIco   = Join-Path $PSScriptRoot "..\build\icon.ico"

$sizes = @(256, 128, 64, 48, 32, 16)

$srcBitmap = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePng).Path)

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$imageStreams = @()
foreach ($size in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($srcBitmap, 0, 0, $size, $size)
    $g.Dispose()
    $imgMs = New-Object System.IO.MemoryStream
    $resized.Save($imgMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    $imageStreams += $imgMs
}

$currentOffset = 6 + (16 * $sizes.Count)
foreach ($i in 0..($sizes.Count - 1)) {
    $size = $sizes[$i]
    $imgBytes = $imageStreams[$i].ToArray()
    $w = if ($size -eq 256) { 0 } else { $size }
    $h = if ($size -eq 256) { 0 } else { $size }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$imgBytes.Length)
    $bw.Write([uint32]$currentOffset)
    $currentOffset += $imgBytes.Length
}

foreach ($imgMs in $imageStreams) {
    $bw.Write($imgMs.ToArray())
    $imgMs.Dispose()
}

$srcBitmap.Dispose()
$bw.Flush()

[System.IO.File]::WriteAllBytes($destIco, $ms.ToArray())
$ms.Dispose()

Write-Host "Icono generado: $destIco"
