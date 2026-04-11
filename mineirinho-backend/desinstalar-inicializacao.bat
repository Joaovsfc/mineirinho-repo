@echo off
echo ============================================
echo  Desinstalador - Mineirinho Backend Auto-Start
echo ============================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute este arquivo como Administrador!
    pause
    exit /b 1
)

echo Removendo tarefa do Task Scheduler...
schtasks /delete /tn "MineirinhoBackend" /f
echo OK!

echo Removendo login automatico...
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon /t REG_SZ /d 0 /f
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultPassword /f 2>nul
echo OK!

echo.
echo Desinstalacao concluida.
pause
