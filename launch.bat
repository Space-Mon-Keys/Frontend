@echo off
echo === Iniciando Frontend ===

REM
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)

REM
echo Ejecutando Vite...
npm run dev

pause
