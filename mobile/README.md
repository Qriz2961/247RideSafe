# 24/7 Rentals & Tours: phone app (iOS + Android)

Expo SDK 58 / React Native 0.88. Same Stage 2 scope as the web app: sample data, everything saved on the phone.

![All screens](docs/screenshots/all-screens.png)

## Run it on your phone (5 minutes)

```bash
cd mobile
npm install
npx expo start          # scan the QR code with the Expo Go app (iPhone camera or Android Expo Go)
```

| Tab | What to try |
|---|---|
| Home | Tap a service to jump into booking |
| Book | Self-drive, with driver, 6-hour Day Tour, Long-term Tour. Taken units are greyed out, not hidden. |
| My bookings | Sign in with `0917 123 4567`, code `123456` (sample customer Ana). Pay a held deposit, request a cancellation, delete the account. |
| Owner | PIN `2470`. Today, Needs action (verify GCash ref nos.), Calendar, Payments, Units (block dates / send to shop), Customers, Texts. "+ Walk-in / Messenger" encodes a booking with the same slot check. |

## How it shares rules with the web app

- `src/lib/shared.ts` imports `../src/lib/{config,format,logic,types,seed}.ts` from the web app (allowed by `metro.config.js`).
- So the slot check, 2-hour buffer, pricing, deposit %, cancellation tiers and house rules are one copy. Change them in `../src/lib/config.ts` and both apps follow.
- `src/lib/store.ts` is the phone's version of the web store: same actions, but saved with AsyncStorage instead of the browser.

## What's real and what's pretend

| Piece | Now | Becomes |
|---|---|---|
| Data | Saved on this phone only | Supabase, shared with the web app (Stage 3) |
| SMS log-in code | Always `123456` | Supabase phone log-in (Stage 4) |
| Owner tab | Demo PIN `2470` | Nole's own log-in; hidden from the public store build (Stage 4) |
| GCash / QR Ph | "Simulate successful payment" | PayMongo hosted checkout opened with `expo-web-browser` + webhook (Stage 5) |
| License / receipt photo | File name only | Upload to a private Supabase bucket (Stage 3–4) |
| Text reminders | Owner's Texts tab | Semaphore, sender `247RENTALS` (Stage 5) |
| Call / Messenger / Viber links | Placeholder numbers in `src/lib/theme.ts` | Nole's real numbers |

## Store rules already handled

- **In-app account deletion** (Apple 5.1.1(v) and Google Play): "Delete my account" in My bookings wipes name, number, email and license no. Booking amounts and dates stay for BIR records.
- Photo permission text is set in `app.json` (Apple rejects apps with vague permission prompts).

## Ship to the stores

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform all     # cloud build, no Mac needed for the iOS build
npx eas-cli@latest submit --platform ios    # needs an Apple Developer account (US$99/yr)
npx eas-cli@latest submit --platform android # needs a Google Play account (US$25 one-time)
```

Bundle ID / package: `ph.rentals247.app` (change in `app.json` before the first build; it can't be changed after).

`npx expo start --web` also runs it in a browser, which is how the screenshots in `docs/screenshots` were taken.
