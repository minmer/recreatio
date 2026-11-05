# REcreatio — rules for every change

- **Localization.** The app speaks English (default), German and Polish. No visible text in code: every text goes
  through `t('<file>.<key>')` / `useT()` from `frontend/src/app/core/i18n.tsx`, with the words in
  `frontend/src/locales/{en,de,pl}/<file>.json` — all three languages, same keys. Read
  [documentation/LOCALIZATION.md](documentation/LOCALIZATION.md) before adding or changing UI, and run
  `npm run app:i18n` (in `frontend/`) before finishing.
- The map of the code is [documentation/ARCHITECTURE.md](documentation/ARCHITECTURE.md).
