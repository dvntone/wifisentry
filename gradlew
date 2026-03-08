#!/bin/sh

# Shim to delegate Gradle wrapper calls to the Android project
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}/android-native" || exit $?
exec ./gradlew "$@"
