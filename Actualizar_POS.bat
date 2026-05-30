@echo off
color 0B
echo ===================================================
echo    ACTUALIZADOR Y COMPILADOR POS - RESTAURANTE
echo ===================================================
echo.
echo [1/4] Descargando ultimos cambios de la nube...
git pull origin main
echo.
echo [2/4] Verificando dependencias...
call npm install
echo.
echo [3/4] Limpiando carpetas de compilaciones anteriores...
rmdir /s /q release 2>nul
echo.
echo [4/4] Compilando la nueva version del instalador...
call npm run electron:build
echo.
echo ===================================================
echo   ¡COMPILACION COMPLETADA!
echo   Busca tu nuevo .exe en la carpeta "release"
echo ===================================================
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul
