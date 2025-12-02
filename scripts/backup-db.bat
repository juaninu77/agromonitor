@echo off
REM Script de backup para base de datos Neon PostgreSQL (Windows)
REM Uso: scripts\backup-db.bat

setlocal enabledelayedexpansion

REM Crear directorio de backups si no existe
if not exist "backups" mkdir backups

REM Obtener fecha y hora
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATE=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=backups\backup_%DATE%.sql

REM Verificar que DATABASE_URL esté configurada
if "%DATABASE_URL%"=="" (
    echo ❌ Error: DATABASE_URL no está configurada
    echo Por favor, configura DATABASE_URL en tu archivo .env
    exit /b 1
)

echo 🔄 Creando backup de la base de datos...

REM Verificar si pg_dump está disponible
where pg_dump >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error: pg_dump no está instalado
    echo Instala PostgreSQL client tools para usar este script
    echo O usa el dashboard de Neon para crear backups manualmente
    exit /b 1
)

REM Crear backup
pg_dump "%DATABASE_URL%" > "%BACKUP_FILE%" 2>&1

if %ERRORLEVEL% EQU 0 (
    echo ✅ Backup creado exitosamente
    echo    Archivo: %BACKUP_FILE%
    
    REM Mantener solo los últimos 7 backups
    echo 🧹 Limpiando backups antiguos (manteniendo últimos 7)...
    for /f "skip=7 delims=" %%F in ('dir /b /o-d backups\backup_*.sql 2^>nul') do del "backups\%%F" 2>nul
    
    echo ✅ Backup completado
) else (
    echo ❌ Error al crear el backup
    if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
    exit /b 1
)

endlocal

