@echo off
color 0B
echo ===================================================
echo    ACTUALIZADOR AUTOMATICO POS - RESTAURANTE
echo ===================================================
echo.
echo [1/3] Descargando ultimos cambios de la nube...
git pull origin main
echo.
echo [2/3] Verificando dependencias (por si algo nuevo se instalo)...
call npm install
echo.
echo [3/3] Aplicando los cambios y reconstruyendo el sistema...
call npm run build
echo.
echo ===================================================
echo   ¡ACTUALIZACION COMPLETADA CON EXITO!
echo ===================================================
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
