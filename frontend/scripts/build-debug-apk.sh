#!/usr/bin/env bash
# Build a development debug APK (assembleDebug) without EAS.
# Requires: Node, JDK 17+, Android SDK, EXPO_PUBLIC_API_BASE_URL
set -euo pipefail

cd "$(dirname "$0")/.."

export CI=1

if [[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" && -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" ]]; then
  echo "EXPO_PUBLIC_API_BASE_URL is required (set in frontend/.env or CI env)" >&2
  exit 1
fi

echo "Building debug APK with API: ${EXPO_PUBLIC_API_BASE_URL}"

npx expo prebuild --platform android --clean --no-install

cd android
chmod +x gradlew
./gradlew :app:assembleDebug --no-daemon

APK="app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "APK not found at android/${APK}" >&2
  exit 1
fi

ls -lh "$APK"
echo "APK_READY=android/${APK}"
