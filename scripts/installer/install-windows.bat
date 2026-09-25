@echo off
setlocal enabledelayedexpansion

title AutoProd - Instalador del Motor Local

echo ==============================================================================
echo                 AUTOPROD AI - INSTALADOR DEL MOTOR LOCAL
echo ==============================================================================
echo.
echo Bienvenido al asistente de instalacion del Motor Local de AutoProd.
echo Este instalador configurara el entorno de procesamiento en tu computadora
echo para renderizado de video, subtitulado Whisper y gestion de canales.
echo.

:: 1. Seleccion de Carpeta Nativa de Windows
echo [1/6] Selecciona la carpeta donde deseas instalar AutoProd...
set "CHOSEN_DIR="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecciona la carpeta donde deseas instalar AutoProd'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::WriteLine($f.SelectedPath) }"`) do (
    set "CHOSEN_DIR=%%I"
)

if "%CHOSEN_DIR%"=="" (
    set "TARGET_DIR=%USERPROFILE%\AutoProdAI"
    echo No seleccionaste ninguna carpeta. Usando ruta por defecto: !TARGET_DIR!
) else (
    set "TARGET_DIR=%CHOSEN_DIR%"
    echo Carpeta seleccionada: !TARGET_DIR!
)

:: Normalizar subcarpeta AutoProdAI
echo !TARGET_DIR! | findstr /i /c:"AutoProdAI" >nul
if errorlevel 1 (
    set "INSTALL_DIR=!TARGET_DIR!\AutoProdAI"
) else (
    set "INSTALL_DIR=!TARGET_DIR!"
)

echo.
echo [2/6] Creando estructura de directorios y recursos de canal en: !INSTALL_DIR!
if not exist "!INSTALL_DIR!\bin" mkdir "!INSTALL_DIR!\bin"
if not exist "!INSTALL_DIR!\workspace" mkdir "!INSTALL_DIR!\workspace"
if not exist "!INSTALL_DIR!\workspace\youtube" mkdir "!INSTALL_DIR!\workspace\youtube"

:: Inicializar rama obligatoria youtube y plantilla de recursos Canal_1
set "CANAL1_DIR=!INSTALL_DIR!\workspace\youtube\Canal_1"
if not exist "!CANAL1_DIR!\InfoCanal" mkdir "!CANAL1_DIR!\InfoCanal"
if not exist "!CANAL1_DIR!\Guiones" mkdir "!CANAL1_DIR!\Guiones"
if not exist "!CANAL1_DIR!\Videos" mkdir "!CANAL1_DIR!\Videos"
if not exist "!CANAL1_DIR!\Miniatura" mkdir "!CANAL1_DIR!\Miniatura"
if not exist "!CANAL1_DIR!\Musica" mkdir "!CANAL1_DIR!\Musica"
if not exist "!CANAL1_DIR!\Imagenes" mkdir "!CANAL1_DIR!\Imagenes"

:: Recursos y plantillas Markdown base
if not exist "!CANAL1_DIR!\InfoCanal\Contexto_canal.md" (
(
echo # Contexto y ADN del Canal: Canal_1
echo.
echo ## 🎯 Nicho y Audiencia Objetivo
echo - **Temática / Nicho:** Temática Principal del Canal
echo - **Público Objetivo:** Creadores y entusiastas del nicho
echo - **Tono de Voz:** Cercano, profesional y dinámico
echo.
echo ## 📋 Directivas de Producción y Marca
echo - **Estilo visual:** Moderno, limpio y minimalista
echo - **Duración promedio:** 8 - 15 minutos
echo - **Frecuencia:** Semanal
) > "!CANAL1_DIR!\InfoCanal\Contexto_canal.md"
)

if not exist "!CANAL1_DIR!\InfoCanal\Metricas_canal.md" (
(
echo # Métricas y Rendimiento del Canal: Canal_1
echo.
echo ^| Fecha ^| Video ^| Vistas ^| CTR Miniatura ^| Retención Media ^|
echo ^|---|---|---|---|---|
echo ^| Registro ^| Video 1 ^(Base^) ^| - ^| - ^| - ^|
) > "!CANAL1_DIR!\InfoCanal\Metricas_canal.md"
)

if not exist "!CANAL1_DIR!\InfoCanal\Historial_canal.md" (
(
echo # Historial de Contenido y Banco de Ideas: Canal_1
echo.
echo ## 📌 Temas Cubiertos
echo - [x] Apertura e inicialización del canal Canal_1
echo.
echo ## 💡 Banco de Ideas Futuras
echo - Idea 1: Introducción a la temática y fundamentos clave
echo - Idea 2: Guía práctica paso a paso para creadores
echo - Idea 3: Análisis de tendencias y errores comunes
) > "!CANAL1_DIR!\InfoCanal\Historial_canal.md"
)

if not exist "!CANAL1_DIR!\Guiones\Plantilla_Guion.md" (
(
echo # Guion: [Título del Video para Canal_1]
echo.
echo ## 🎣 Gancho Inicial ^(0:00 - 0:30^)
echo - Planteamiento del problema y por qué este contenido es indispensable.
echo.
echo ## 📖 Desarrollo Principal ^(0:30 - 7:00^)
echo - Punto 1: Concepto clave y contexto
echo - Punto 2: Demostración práctica y desglose de valor
echo - Punto 3: Conclusión accionable
echo.
echo ## 🚀 Llamado a la Acción y Cierre ^(7:00 - 8:00^)
echo - Pregunta para interacción en comentarios y cierre de video.
) > "!CANAL1_DIR!\Guiones\Plantilla_Guion.md"
)

if not exist "!CANAL1_DIR!\Videos\README.md" (
(
echo # Videos y Clips ^(Canal_1^)
echo Almacenamiento de metraje bruto, grabaciones y exportaciones finales.
) > "!CANAL1_DIR!\Videos\README.md"
)

if not exist "!CANAL1_DIR!\Miniatura\Ideas_Miniaturas.md" (
(
echo # Conceptos de Miniaturas: Canal_1
echo.
echo - **Concepto 1:** Expresión de alto impacto con elemento central de contraste.
echo - **Tipografía:** Máximo 3 palabras grandes y legibles en dispositivos móviles.
echo - **Colores:** Tonos vibrantes sobre fondo oscuro.
) > "!CANAL1_DIR!\Miniatura\Ideas_Miniaturas.md"
)

if not exist "!CANAL1_DIR!\Musica\README.md" (
(
echo # Música de Fondo ^(Canal_1^)
echo Pistas musicales y efectos sonoros libres de derechos de autor.
) > "!CANAL1_DIR!\Musica\README.md"
)

if not exist "!CANAL1_DIR!\Imagenes\README.md" (
(
echo # Recursos Gráficos e Imágenes ^(Canal_1^)
echo Banners, texturas, capturas y miniaturas generadas con IA.
) > "!CANAL1_DIR!\Imagenes\README.md"
)

:: Detectar si existe el ejecutable compilado autoprod-motor.exe
set "MOTOR_EXE="
if exist "%~dp0autoprod-motor.exe" (
    set "MOTOR_EXE=%~dp0autoprod-motor.exe"
) else if exist "%~dp0..\..\dist\autoprod-motor.exe" (
    set "MOTOR_EXE=%~dp0..\..\dist\autoprod-motor.exe"
) else if exist "%~dp0..\..\controlador\dist\autoprod-motor.exe" (
    set "MOTOR_EXE=%~dp0..\..\controlador\dist\autoprod-motor.exe"
)

if defined MOTOR_EXE (
    echo Instalando ejecutable compilado del motor local...
    copy /y "!MOTOR_EXE!" "!INSTALL_DIR!\autoprod-motor.exe" >nul
) else (
    :: Modo desarrollo: Copiar archivos del motor si no hay binario compilado
    if not exist "!INSTALL_DIR!\motor" mkdir "!INSTALL_DIR!\motor"
    if exist "%~dp0..\..\controlador" (
        echo Copiando archivos de desarrollo del motor local...
        xcopy /s /e /y /q "%~dp0..\..\controlador\*" "!INSTALL_DIR!\motor\" >nul
    ) else if exist "%~dp0controlador" (
        xcopy /s /e /y /q "%~dp0controlador\*" "!INSTALL_DIR!\motor\" >nul
    ) else if exist "%~dp0motor" (
        xcopy /s /e /y /q "%~dp0motor\*" "!INSTALL_DIR!\motor\" >nul
    )
)

:: 3. Descarga de Binarios Portables (ffmpeg y yt-dlp)
echo.
echo [3/6] Verificando binarios portables (FFmpeg y yt-dlp)...

if not exist "!INSTALL_DIR!\bin\yt-dlp.exe" (
    echo Descargando yt-dlp portable...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '!INSTALL_DIR!\bin\yt-dlp.exe'"
)

if not exist "!INSTALL_DIR!\bin\ffmpeg.exe" (
    echo Descargando FFmpeg portable (esto puede tardar unos segundos)...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile '!INSTALL_DIR!\bin\ffmpeg.zip'"
    echo Extrayendo FFmpeg...
    powershell -NoProfile -Command "Expand-Archive -Path '!INSTALL_DIR!\bin\ffmpeg.zip' -DestinationPath '!INSTALL_DIR!\bin\ffmpeg_temp' -Force"
    for /r "!INSTALL_DIR!\bin\ffmpeg_temp" %%f in (ffmpeg.exe) do (
        copy /y "%%f" "!INSTALL_DIR!\bin\ffmpeg.exe" >nul
    )
    for /r "!INSTALL_DIR!\bin\ffmpeg_temp" %%f in (ffprobe.exe) do (
        copy /y "%%f" "!INSTALL_DIR!\bin\ffprobe.exe" >nul
    )
    rmdir /s /q "!INSTALL_DIR!\bin\ffmpeg_temp" 2>nul
    del /f /q "!INSTALL_DIR!\bin\ffmpeg.zip" 2>nul
)

:: 4. Configuracion de Entorno (Solo si no hay binario .exe compilado)
echo.
if exist "!INSTALL_DIR!\autoprod-motor.exe" (
    echo [4/6] Motor compilado listo. No se requiere instalacion de Python.
) else (
    echo [4/6] Verificando entorno de Python (Modo desarrollo)...
    set "PY_CMD=python"
    python --version >nul 2>&1
    if errorlevel 1 (
        py --version >nul 2>&1
        if not errorlevel 1 (
            set "PY_CMD=py"
        ) else (
            echo [AVISO] No se detecto Python en el sistema.
            echo Descargando e instalando Python 3.10...
            powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe' -OutFile '!INSTALL_DIR!\python_installer.exe'"
            start /wait "" "!INSTALL_DIR!\python_installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0
            del /f /q "!INSTALL_DIR!\python_installer.exe" 2>nul
        )
    )

    echo Creando entorno virtual aislado (venv)...
    if not exist "!INSTALL_DIR!\venv" (
        !PY_CMD! -m venv "!INSTALL_DIR!\venv"
    )

    echo Instalando dependencias del motor local...
    call "!INSTALL_DIR!\venv\Scripts\activate.bat"
    python -m pip install --upgrade pip --quiet
    if exist "!INSTALL_DIR!\motor\requirements.txt" (
        pip install -r "!INSTALL_DIR!\motor\requirements.txt" --quiet
    ) else (
        pip install fastapi uvicorn pydantic requests --quiet
    )
)

:: 5. Generacion de Archivo de Configuracion y Lanzador
echo.
echo [5/6] Generando configuracion y lanzador...

(
echo {
echo   "basePath": "!INSTALL_DIR:\=\\!\\workspace\\youtube",
echo   "binPath": "!INSTALL_DIR:\=\\!\\bin",
echo   "version": "1.0.0"
echo }
) > "!INSTALL_DIR!\.autoprod-config.json"

:: Crear start_motor.bat
if exist "!INSTALL_DIR!\autoprod-motor.exe" (
(
echo @echo off
echo title AutoProd Local Motor
echo cd /d "%%~dp0"
echo set "PATH=%%~dp0bin;%%PATH%%"
echo echo ===================================================
echo echo       AUTOPROD MOTOR LOCAL EN EJECUCION
echo echo       Puerto: http://127.0.0.1:8000
echo echo ===================================================
echo autoprod-motor.exe
echo pause
) > "!INSTALL_DIR!\start_motor.bat"
) else (
(
echo @echo off
echo title AutoProd Local Motor
echo cd /d "%%~dp0"
echo set "PATH=%%~dp0bin;%%PATH%%"
echo call "%%~dp0venv\Scripts\activate.bat"
echo echo ===================================================
echo echo       AUTOPROD MOTOR LOCAL EN EJECUCION
echo echo       Puerto: http://127.0.0.1:8000
echo echo ===================================================
echo cd motor
echo python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
echo pause
) > "!INSTALL_DIR!\start_motor.bat"
)

:: Crear acceso directo en el Escritorio
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\AutoProd Motor.lnk'); $s.TargetPath = '!INSTALL_DIR!\start_motor.bat'; $s.WorkingDirectory = '!INSTALL_DIR!'; $s.IconLocation = 'shell32.dll,43'; $s.Save()" 2>nul

:: 6. Iniciar el Motor Local y Abrir el Navegador
echo.
echo [6/6] Instalacion completada exitosamente!
echo Iniciando el Motor Local...

start "" "!INSTALL_DIR!\start_motor.bat"

echo Esperando que el motor inicie en http://127.0.0.1:8000 ...
timeout /t 3 /nobreak >nul

echo Abriendo AutoProd en tu navegador...
start "" "https://autoprod.io/dashboard" 2>nul || start "" "http://localhost:3000/dashboard"

echo.
echo ==============================================================================
echo  TODO LISTO: Tu Motor Local de AutoProd ya esta configurado y conectado.
echo  Puedes cerrar esta ventana.
echo ==============================================================================
pause
