@echo off
REM Shim to delegate Gradle wrapper calls to the Android project
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%android-native"
call .\gradlew.bat %*
