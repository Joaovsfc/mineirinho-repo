@echo off
echo ============================================
echo  Instalador - Mineirinho Backend Auto-Start
echo ============================================
echo.

REM Verificar se esta rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute este arquivo como Administrador!
    echo Clique com botao direito e escolha "Executar como administrador"
    pause
    exit /b 1
)

echo [1/3] Registrando servidor no Task Scheduler...
schtasks /create /tn "MineirinhoBackend" /tr "wscript.exe \"C:\Users\Pichau\mineirinho-repo\mineirinho-backend\start-backend-hidden.vbs\"" /sc ONLOGON /rl HIGHEST /f

if %errorLevel% equ 0 (
    echo     OK - Tarefa criada com sucesso!
) else (
    echo     ERRO ao criar tarefa no Task Scheduler
    pause
    exit /b 1
)

echo.
echo [2/3] Configurando login automatico sem senha...
echo.
echo ATENCAO: Isso ira remover a senha da conta Pichau
echo          e fazer o Windows logar automaticamente.
echo.
set /p CONFIRMAR="Deseja configurar login automatico? (S/N): "
if /i "%CONFIRMAR%"=="S" (
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v AutoAdminLogon /t REG_SZ /d 1 /f
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultUserName /t REG_SZ /d "Pichau" /f
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v DefaultPassword /t REG_SZ /d "" /f
    reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" /v ForceAutoLogon /t REG_SZ /d 1 /f
    echo     OK - Login automatico configurado!
) else (
    echo     Pulando configuracao de login automatico.
)

echo.
echo [3/3] Concluido!
echo.
echo O servidor ira iniciar automaticamente na proxima vez
echo que o Windows ligar (sem mostrar janela do terminal).
echo.
echo Para testar agora, execute: start-backend.bat
echo Para desinstalar, execute:  desinstalar-inicializacao.bat
echo.
pause
