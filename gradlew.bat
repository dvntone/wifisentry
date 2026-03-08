@echo off
rem Root-level Gradle wrapper shim — delegates to android-native\gradlew.bat.
rem Required because some CI tools expect a wrapper at the repository root.
rem /d flag changes drive letter too; %~dp0 resolves to script's own directory.
cd /d "%~dp0android-native"
if errorlevel 1 (
    echo ERROR: android-native directory not found. Cannot delegate to Gradle wrapper.
    exit /b 1
)
call gradlew.bat %*
