# Contributing

## Local Development

### Prerequisites

- Node.js
- npm
- Expo-compatible Android or iOS development environment
- Firebase project configuration for local development

### Installation

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

From the Expo dev server, open the app in a development build, Android emulator, iOS simulator, or Expo Go when supported by the native dependencies in use.

## Available Scripts

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
```

## Project Structure

```text
app/          Expo Router screens and routes
components/   Reusable UI components
contexts/     App-wide React contexts
hooks/        Shared data and behavior hooks
services/     Firebase, wallet, transaction, image, and notification services
constants/    Theme values and static configuration
utils/        Formatting and layout helpers
docs/         Changelog, privacy policy, and terms
```

## Development Notes

- Keep user-facing copy clear and consistent with Fastra's personal finance focus.
- Review notification import behavior carefully because imported data may be incomplete or inaccurate.
- Run lint before opening a pull request:

```bash
npm run lint
```
