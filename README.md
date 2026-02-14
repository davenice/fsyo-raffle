# FSYO Raffle Display

A retro terminal-styled raffle ticket display app with camera scanning support.

## Features

- Manual ticket entry with color selection
- Camera-based ticket scanning with OCR (Tesseract.js)
- Automatic color detection from scanned tickets
- Retro green-on-black terminal aesthetic

## Development

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

This starts a local HTTPS server (required for camera access). Open the Network URL on your phone to test scanning.

### Build

```bash
npm run build
```

Output is in the `dist/` folder.

## Deployment

### Deploy to GitHub Pages

```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch. The site will be available at:

https://davenice.github.io/fsyo-raffle/

### First-time setup

If GitHub Pages isn't enabled:
1. Go to repo Settings > Pages
2. Set Source to `gh-pages` branch
3. Save

## Tech Stack

- React 19
- TypeScript
- Vite
- Tesseract.js (OCR)
