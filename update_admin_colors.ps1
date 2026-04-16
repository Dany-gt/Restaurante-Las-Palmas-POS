$adminDir = "c:\Users\CyR Las Palmas\Documents\Restaurante Las Palmas POS\components\admin"
$files = Get-ChildItem -Path $adminDir -Filter *.tsx

foreach ($file in $files) {
    Write-Host "Procesando $($file.Name)..."
    $content = Get-Content -Path $file.FullName -Raw
    
    # Reposiciones para hexadecimal 0078d7 (variaciones de camel case y minúsculas por si acaso)
    $content = $content -replace "bg-\[#0078d7\]", "bg-[#003366]"
    $content = $content -replace "text-\[#0078d7\]", "text-[#003366]"
    $content = $content -replace "border-\[#0078d7\]", "border-[#003366]"
    $content = $content -replace "focus:border-\[#0078d7\]", "focus:border-[#003366]"
    $content = $content -replace "focus-within:border-\[#0078d7\]", "focus-within:border-[#003366]"
    $content = $content -replace "hover:bg-\[#0078d7\]", "hover:bg-[#003366]"
    
    # Reposiciones para Tailwind blue-600
    $content = $content -replace "bg-blue-600", "bg-[#003366]"
    $content = $content -replace "text-blue-600", "text-[#003366]"
    $content = $content -replace "border-blue-600", "border-[#003366]"
    $content = $content -replace "accent-blue-600", "accent-[#003366]"
    $content = $content -replace "ring-blue-600", "ring-[#003366]"
    
    # Casos específicos de hover y focus con blue-600
    $content = $content -replace "hover:bg-blue-600", "hover:bg-[#002244]"
    $content = $content -replace "focus:ring-blue-600", "focus:ring-[#003366]"
    
    Set-Content -Path $file.FullName -Value $content -NoNewline
}

Write-Host "¡Cambios completados exitosamente en todos los módulos administrativos!"
