# Resource Vault

## UX Rules
- Native browser dialogs (`alert`, `prompt`, `confirm`) are forbidden in `src/`.
- Use `src/ui/feedback.js` for:
  - `toast(...)`
  - `confirmDialog(...)`
  - `promptDialog(...)`

## Local Checks
- `npm run check`:
  - detects potential mojibake in `src/**/*.{js,css,html}`
  - blocks native dialog API usage in `src/**/*.js`
