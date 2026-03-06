# WiFi Sentry Android Build Diagnostic Script

Write-Host "--- Android Build Diagnostic ---" -ForegroundColor Cyan

# 1. Check Java version
Write-Host "`n1. Checking Java Version..." -ForegroundColor Yellow
try {
    java -version
} catch {
    Write-Error "Java is not found in your PATH."
}

# 2. Check JAVA_HOME
Write-Host "`n2. Checking JAVA_HOME..." -ForegroundColor Yellow
if ($env:JAVA_HOME) {
    Write-Host "JAVA_HOME is set to: $($env:JAVA_HOME)"
} else {
    Write-Warning "JAVA_HOME is NOT set."
}

# 3. Check Gradle Wrapper
Write-Host "`n3. Checking Gradle Wrapper..." -ForegroundColor Yellow
if (Test-Path "gradlew") {
    Write-Host "gradlew found."
} else {
    Write-Error "gradlew NOT found in current directory."
}

# 4. Run Build with Stacktrace and Info
Write-Host "`n4. Running Android Build (:app:assembleDebug)..." -ForegroundColor Yellow
Write-Host "This may take a few minutes. Output is being captured to build_diagnostic.log"

./gradlew :app:assembleDebug --stacktrace --info > build_diagnostic.log 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS: Build completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nFAILURE: Build failed. Check build_diagnostic.log for details." -ForegroundColor Red
}

Write-Host "`n--- Diagnostic Complete ---" -ForegroundColor Cyan
