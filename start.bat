@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
set "LOG_FILE=%TEMP%\archeio-setup.log"
cd /d "%ROOT_DIR%" || goto :root_error
type nul > "%LOG_FILE%"

echo Archeio setup

set "MISSING_TOOLS="
where soffice >nul 2>&1 || set "MISSING_TOOLS=1"
where ebook-convert >nul 2>&1 || set "MISSING_TOOLS=1"
where gswin64c >nul 2>&1 || where gswin32c >nul 2>&1 || set "MISSING_TOOLS=1"
if defined MISSING_TOOLS (
  echo Optional manual step for Office, EPUB, and PDF conversions:
  echo   Install LibreOffice, Calibre, and Ghostscript, then add their folders to PATH.
  echo   LibreOffice: https://www.libreoffice.org/download/download/
  echo   Calibre:     https://calibre-ebook.com/download
  echo   Ghostscript: https://ghostscript.com/releases/gsdnld.html
  echo Continuing without those optional conversion features.
) else (
  echo Conversion tools found.
)

where node >nul 2>&1 || goto :node_error
where npm >nul 2>&1 || goto :node_error
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 20 && minor >= 19) || (major >= 22 && !(major === 22 && minor < 12)) ? 0 : 1)" >nul 2>&1 || goto :node_error

where py >nul 2>&1
if not errorlevel 1 (
  set "PYTHON=py -3"
) else (
  set "PYTHON=python"
)
%PYTHON% -c "import sys; raise SystemExit(sys.version_info ^< (3, 10))" >nul 2>&1 || goto :python_error

if not exist "venv\Scripts\python.exe" (
  echo Creating Python environment...
  %PYTHON% -m venv venv >> "%LOG_FILE%" 2>&1 || goto :venv_error
)

echo Installing Python packages...
venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel >> "%LOG_FILE%" 2>&1 || goto :python_packages_error
venv\Scripts\python.exe -m pip install -r backend\requirements.txt >> "%LOG_FILE%" 2>&1 || goto :python_packages_error

echo Downloading OCR models...
pushd backend
..\venv\Scripts\python.exe -m ocr_pipeline.bootstrap --download-models >> "%LOG_FILE%" 2>&1 || (popd & goto :models_error)
popd

echo Installing Node packages...
call npm --prefix frontend ci --silent --no-audit --no-fund >> "%LOG_FILE%" 2>&1 || goto :frontend_packages_error
call npm --prefix backend ci --silent --no-audit --no-fund >> "%LOG_FILE%" 2>&1 || goto :backend_packages_error

if not exist "frontend\.env" echo VITE_API_URL=http://localhost:3001> "frontend\.env"
echo Setup complete.

if "%~1"=="--setup-only" goto :end

call :release_port 3001
call :release_port 5173
echo Starting Archeio...
start "Archeio Backend" /min cmd.exe /c "cd /d ""%ROOT_DIR%backend"" ^&^& npm run dev"
start "Archeio Frontend" /min cmd.exe /c "cd /d ""%ROOT_DIR%frontend"" ^&^& npm run dev"

set /a ATTEMPT=0
:wait_for_frontend
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  start "" "http://localhost:5173"
  echo Archeio is ready at http://localhost:5173
  goto :end
)
set /a ATTEMPT+=1
if %ATTEMPT% GEQ 30 goto :frontend_error
timeout /t 1 /nobreak >nul
goto :wait_for_frontend

:release_port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do taskkill /PID %%P /F >nul 2>&1
exit /b 0

:root_error
echo Could not open the Archeio folder.
goto :end
:node_error
echo Node.js 20.19+ or 22.12+ is required. Install it, then run this launcher again.
goto :end
:python_error
echo Python 3.10+ is required. Install it, then run this launcher again.
goto :end
:venv_error
echo Could not create the Python environment. Details: %LOG_FILE%
goto :end
:python_packages_error
echo Could not install Python packages. Details: %LOG_FILE%
goto :end
:models_error
echo Could not download or verify OCR models. Details: %LOG_FILE%
goto :end
:frontend_packages_error
echo Could not install frontend packages. Details: %LOG_FILE%
goto :end
:backend_packages_error
echo Could not install backend packages. Details: %LOG_FILE%
goto :end
:frontend_error
echo The frontend did not become ready. Check the Archeio server windows.

:end
endlocal
