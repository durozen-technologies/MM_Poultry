# Broiler Wholesale mobile app (Expo SDK 57)

Requires **Expo Go SDK 57** on your phone (update Expo Go from the store if needed).

```bash
cd frontend
npm install
cp .env.example .env
# For a physical device, set EXPO_PUBLIC_API_BASE_URL to your PC LAN IP, e.g. http://10.110.32.151:8000
npx expo start -c
```

Demo logins (org slug `demo` for tenant users): see `../.core/TEST_CREDENTIALS.md`.

Note: Bluetooth scale / thermal printer need a **dev client** build; Expo Go covers UI + API flows.
