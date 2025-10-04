@echo off
setlocal
set IMAGE_NAME=frontend-app_image
set CONTAINER_NAME=frontend-app_container

REM
echo [INFO] Construyendo la imagen Docker...
docker build -t %IMAGE_NAME% .

REM
echo [INFO] Lanzando el contenedor Docker...
docker run --rm -p 5173:5173 --name %CONTAINER_NAME% %IMAGE_NAME%
endlocal
