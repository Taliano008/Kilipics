# KiliPicks Mobile

Android-first, iOS-compatible React Native application starter for the KiliPicks consumer product. It is a separate codebase from the web demo and consumes the same public catalog and analytics APIs.

## Included in this delivery

- Live Home screen backed by the KiliPicks public merchant catalog
- Search by business, service/category and Nairobi area
- Signed versus unsigned listing disclosure rules
- Provider details with services and booking eligibility
- Local saved-business shortlist
- Existing KiliPicks analytics ingestion integration
- Expo Application Services build profiles for development, preview APK and production
- Chinese PRD and technical handoff in [`docs/`](docs/)

## Requirements

- Node.js 22+
- pnpm 11+ (pinned via `packageManager` in `package.json`; run through Corepack: `corepack enable`)
- Android Studio emulator or an Android phone with Expo Go
- macOS + Xcode is required only for a local iOS simulator; cloud iOS builds can use EAS

## Run locally

```bash
cp .env.example .env
pnpm install
pnpm start
```

Then press `a` for an Android emulator, or scan the QR code from Expo Go on a phone connected to the same network.

To use a local web backend from a physical phone, do not use `127.0.0.1`. Set `EXPO_PUBLIC_API_BASE_URL` to the computer's LAN IP, for example:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:4173
```

The default environment points to the existing public KiliPicks backend:

```text
https://nairobi-local-picks-demo.hantianyang5.chatgpt.site
```

## Validate

```bash
pnpm typecheck
```

## Create an installable Android preview

1. Install and sign in to EAS CLI: `pnpm add -g eas-cli && eas login`.
2. Run `eas init` and replace the placeholder project ID in `app.json`.
3. Build an APK with `eas build --platform android --profile preview`.

Production store binaries use `eas build --platform android --profile production` and `eas build --platform ios --profile production`.

## Current product boundary

This is an executable MVP starter, not a finished production marketplace. Authentication, real appointment creation, M-Pesa payments, push notifications, maps, reviews and community publishing require product approval and backend implementation. The booking screen records intent only and says so explicitly.
