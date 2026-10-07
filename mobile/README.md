# Fuel Management — Mobile App

React Native (Expo) client for the Fuel Expense & Slip Management System.

## Setup

```bash
cp .env.example .env    # set EXPO_PUBLIC_API_URL to your backend's address
npm install
npm start
```

- `npm start` — launches the Expo dev server (scan the QR code with Expo Go, or press `a`/`w`
  for an Android emulator / web browser).
- `npm run android` — launches directly on a connected Android device/emulator.
- `npm run typecheck` — runs `tsc --noEmit`.

When testing on a physical device, make sure `EXPO_PUBLIC_API_URL` in `.env` points to your
computer's LAN IP (e.g. `http://192.168.1.10:5000`), not `localhost`.

## Structure

- `src/screens/driver/` — driver-facing flows: upload slip, OCR review, my entries.
- `src/screens/office/` — office/admin flows: dashboard, fuel records, drivers, vehicles,
  users, reports.
- `src/screens/shared/` — screens used by more than one role (entry detail, profile).
- `src/services/` — one file per backend resource, each wrapping `services/api.ts`.
- `src/components/` — shared UI building blocks, including `components/charts/`.
- `src/context/` — `AuthContext` (session/token) and `ToastContext` (in-app notifications).
