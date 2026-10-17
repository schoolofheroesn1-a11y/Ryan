@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден. Устанавливаю Python 3.12 через winget...
  winget install -e --id Python.Python.3.12
  echo Перезапустите этот файл после установки.
  pause
  exit /b
)
python -m pip install -r requirements.txt
python main.py %*
pause
