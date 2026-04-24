$adminDir = "c:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\components\admin"
$files = Get-ChildItem -Path $adminDir -Filter *.tsx

foreach ($file in $files) {
    Write-Host "Limpiando remanentes en $($file.Name)..."
    $content = Get-Content -Path $file.FullName -Raw
    
    # Colores directos y hovers que podrían haber quedado
    $content = $content -replace "text-blue-500", "text-[#003366]"
    $content = $content -replace "bg-blue-500", "bg-[#003366]"
    $content = $content -replace "border-blue-500", "border-[#003366]"
    $content = $content -replace "hover:bg-blue-500", "hover:bg-[#002244]"
    $content = $content -replace "hover:text-blue-500", "hover:text-[#003366]"
    
    # Casos de hex #3399ff que vi en ConfigReceivable
    $content = $content -replace "#3399ff", "#003366"
    $content = $content -replace "#2e8aea", "#002244" # Hover típico de 3399ff
    
    # Bordes de focus adicionales
    $content = $content -replace "focus:border-blue-400", "focus:border-[#003366]"
    $content = $content -replace "focus:ring-blue-400", "focus:ring-[#003366]"
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "¡Limpieza profunda de colores completada!"
