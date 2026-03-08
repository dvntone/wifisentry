#!/bin/sh
# Root-level Gradle wrapper shim — delegates to android-native/gradlew.
# Required because some CI tools (e.g. GitHub Actions Gradle cache action)
# expect a wrapper at the repository root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/android-native"
exec ./gradlew "$@"
