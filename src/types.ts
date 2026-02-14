export const COLOURS = [
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Orange',
  'Purple',
  'Pink',
  'White',
] as const;

export type RaffleColour = (typeof COLOURS)[number];

export interface RaffleTicket {
  id: number;
  number: string;
  colour: RaffleColour;
}
