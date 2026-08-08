#!/usr/bin/env bash
# Build a development debug APK (assembleDebug) without EAS.
# Requires: Node, JDK 17+, Android SDK
# EXPO_PUBLIC_API_BASE_URL is optional for debug/dev-client builds:
#   - If set (env / frontend/.env), it may be baked at prebuild time
#   - If unset, Metro + laptop frontend/.env supplies the URL at run time
set -euo pipefail

cd "$(dirname "$0")/.."

export CI=1

if [[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" && -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -n "${EXPO_PUBLIC_API_BASE_URL:-}" ]]; then
  echo "Building debug APK (optional bake-in API: ${EXPO_PUBLIC_API_BASE_URL})"
else
  echo "Building debug APK without baked API URL — use laptop frontend/.env with Metro (--dev-client)"
fi

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
