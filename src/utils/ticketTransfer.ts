import type { RaffleTicket, RaffleColour } from '../types';

// Compact colour encoding: single character per colour
const COLOUR_TO_CHAR: Record<RaffleColour, string> = {
  Red: 'R',
  Blue: 'B',
  Green: 'G',
  Yellow: 'Y',
  Orange: 'O',
  Purple: 'P',
  Pink: 'K',
  White: 'W',
};

const CHAR_TO_COLOUR: Record<string, RaffleColour> = {
  R: 'Red',
  B: 'Blue',
  G: 'Green',
  Y: 'Yellow',
  O: 'Orange',
  P: 'Purple',
  K: 'Pink',
  W: 'White',
};

// Compact comma-delimited format: "12345R,678B,12346G"
export function encodeTickets(tickets: RaffleTicket[]): string {
  return tickets.map((t) => t.number + COLOUR_TO_CHAR[t.colour]).join(',');
}

export function decodeTickets(data: string): RaffleTicket[] | null {
  try {
    if (!data) return null;
    return data.split(',').map((entry, index) => {
      const colourChar = entry.slice(-1);
      const number = entry.slice(0, -1);
      return {
        id: Date.now() + index,
        number,
        colour: CHAR_TO_COLOUR[colourChar] || 'White',
      };
    });
  } catch {
    return null;
  }
}

export function estimateQRSize(tickets: RaffleTicket[]): number {
  return encodeTickets(tickets).length;
}

// QR code can hold ~2000 bytes comfortably
export const MAX_SAFE_BYTES = 2000;
