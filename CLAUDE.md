# CLAUDE.md - AI Agent Context

## Project Overview

**FSYO Raffle Display** is a retro terminal-styled web application for managing raffle ticket entries at live events. Users can manually add tickets, scan physical tickets using camera OCR, and export/import ticket collections via QR codes.

## Tech Stack

- **React 19** with TypeScript 5.9
- **Vite 7** for build tooling
- **Tesseract.js** for OCR (optical character recognition)
- **jsQR** for QR code scanning
- **qrcode.react** for QR code generation

## Project Structure

```
src/
├── components/
│   ├── Scanner/        # Camera-based ticket scanning with OCR + color detection
│   ├── QRExport/       # Generate QR codes for ticket backup/transfer
│   └── QRImport/       # Scan QR codes to import tickets
├── hooks/
│   └── useOCR.ts       # Tesseract.js wrapper hook
├── utils/
│   └── ticketTransfer.ts  # Ticket encoding/decoding for QR codes
├── types.ts            # RaffleTicket and RaffleColour types
├── App.tsx             # Main app with ticket state management
└── App.css             # Retro terminal styling
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (HTTPS required for camera)
npm run build        # Type check + production build
npm run lint         # Run ESLint
npm run deploy       # Deploy to GitHub Pages
```

## Key Concepts

- **RaffleTicket**: `{ id: string, number: string, colour: RaffleColour }`
- **RaffleColour**: `'Red' | 'Blue' | 'Green' | 'Yellow' | 'Orange' | 'Purple' | 'Pink' | 'White'`
- **QR Format**: Compact encoding like `"12345R,678B,12346G"` (number + color initial)

## Ticket Import/Export

Tickets can be transferred between devices or backed up using QR codes:

- **Export** (`QRExport.tsx`): Encodes all tickets into a compact string format using `ticketTransfer.ts`. Each ticket becomes `{number}{colorInitial}` (e.g., "12345R" for red ticket #12345), comma-separated. Uses qrcode.react to render as SVG with high error correction (level H). Max capacity ~130 tickets per QR code.
- **Import** (`QRImport.tsx`): Uses device camera with jsQR library for real-time QR detection. Scans frame-by-frame using requestAnimationFrame. Decoded tickets are merged with existing collection (no duplicates).
- **Data format**: `ticketTransfer.ts` handles encoding (`encodeTickets`) and decoding (`decodeTickets`). Color codes: R=Red, B=Blue, G=Green, Y=Yellow, O=Orange, U=Purple, P=Pink, W=White.

## Ticket OCR Scanning

Physical tickets are scanned using the device camera with OCR:

- **Tesseract.js**: Open-source OCR engine compiled to WebAssembly. Runs in a Web Worker to avoid blocking the UI thread. Configured to recognize digits only (0-9) for ticket numbers.
- **useOCR hook**: Lazy-initializes the Tesseract worker on first use, caches it for subsequent scans. Returns `{ recognize, isProcessing, error, progress }`.
- **Color detection**: Analyzes RGB pixel values from the camera frame's scan region. Compares against predefined color values using Euclidean distance in RGB space to find the closest match.
- **Scanner flow**: Camera captures frame → extracts scan region → runs OCR for number → analyzes pixels for color → user confirms/edits → ticket added.

## Architecture Notes

- All state managed in App.tsx via React hooks (no Redux/Context)
- Heavy components (Scanner, QRExport, QRImport) are lazy-loaded with Suspense
- Scanner uses state machine pattern: idle → camera-loading → ready → capturing → processing → confirm
- Color detection analyzes pixel RGB values using Euclidean distance matching
- OCR runs in Web Worker to avoid UI blocking

## Styling Conventions

- Retro terminal aesthetic: green (#0f0) on black (#000)
- CSS variables for colors: `--colour-red`, `--colour-blue`, etc.
- `data-colour` attributes for dynamic ticket styling
- Monospace font (Courier New)
- ASCII art borders and UI elements

## Deployment

- GitHub Pages: https://davenice.github.io/fsyo-raffle/
- Base path configured in vite.config.ts for subdirectory hosting
