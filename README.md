# BillTracker

BillTracker is a React Native / Expo app for tracking recurring bills and contracts on-device.

It helps you:

- Track providers, billing cycles, billing days, amounts, and notes
- Auto-generate upcoming bills from saved contracts
- Mark bills as paid and store the actual payment date
- Attach proof of payment and contract documents
- Scan documents with auto-crop and store scans as PDF
- Restore and export backups as ZIP files
- Receive local reminders for upcoming and overdue bills
- Use the app in English or German

## Repository Layout

The actual mobile app lives in `app/`.

- `app/src/screens`: app screens
- `app/src/components`: reusable UI
- `app/src/database`: SQLite schema and CRUD
- `app/src/services`: bill generation, backups, notifications
- `app/src/localization`: i18n strings
- `app/src/types`: shared types/constants

## Tech Stack

- React Native 0.81 with Expo SDK 54
- TypeScript with strict mode
- SQLite via `expo-sqlite`
- React Navigation
- React Native Paper
- `i18next` / `react-i18next`
- `date-fns`
- `expo-notifications`
- `jszip`
- ML Kit document scanner for auto-cropped scans

## Features

### Contracts

- Create, edit, and delete recurring contracts
- Set category, amount, currency, billing cycle, billing day, start/end dates, payment method, and notes
- Add contract documents by importing PDF or scanning directly

### Bills

- Automatically generate bills from contract rules
- View bill details and linked contract
- Mark bills as paid or unpaid
- Choose the actual payment date when marking a bill as paid
- Add notes and proof of payment
- Scan proof documents with auto-crop and save them as PDF

### Backups

- Export all data, proofs, and contract documents into a ZIP backup
- Choose the destination directory when exporting
- Import a ZIP backup from the device filesystem

### Settings

- Language: English / German
- Theme: system / light / dark
- Default currency
- Bill lookahead window
- Reminder settings for due, pre-due, and overdue notifications

## Data Model

SQLite tables:

- `settings`
- `contracts`
- `bills`
- `contract_documents`

All data is stored locally on the device.

## Getting Started

### Prerequisites

- Node.js
- npm
- Android Studio / Android SDK for Android builds
- An Expo dev build or Android emulator/device

### Install

From the repository root:

```bash
cd app
npm install
```

### Run in Development

```bash
cd app
npx expo start
```

This project is intended primarily for Android. Some flows use Android-specific behavior such as opening PDFs with the device viewer through intents.


## Important Expo / SDK Notes

- Use `expo-file-system/legacy` when you need `documentDirectory`, `EncodingType`, or legacy helpers already used in the app
- Use `SQLiteBindValue[]` for SQLite bind params
- Use `expo-crypto` `Crypto.randomUUID()` instead of `uuid`
- `expo-notifications` should use `shouldShowBanner: true` and `shouldShowList: true`
- Android date selection uses `@react-native-community/datetimepicker`

## Architecture Notes

- `app/src/database/db.ts`: CRUD and query layer
- `app/src/database/schema.ts`: schema creation and lightweight migrations
- `app/src/services/billGeneration.ts`: recurring bill generation
- `app/src/services/exportImport.ts`: ZIP backup/export/import
- `app/src/services/notifications.ts`: local reminders
- `app/src/types/index.ts`: shared models and constants
