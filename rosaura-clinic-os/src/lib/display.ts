export interface DisplayLine {
  name: string;
  quantity: number;
  amount: number;
}

export interface CustomerBill {
  clientName: string;
  lines: DisplayLine[];
  total: number;
}

export interface QueueCard {
  id: string;
  name: string;
  time: string;
}

export interface BedCard {
  name: string;
  clientName: string | null;
}

export const DISPLAY_PROMO_SLOTS = ["qris", "hotline", "review"] as const;

export type DisplayPromoSlot = (typeof DISPLAY_PROMO_SLOTS)[number];

export interface DisplayPromoSlide {
  id: string;
  url: string;
}

export interface DisplayPromos {
  qris: DisplayPromoSlide[];
  hotline: DisplayPromoSlide[];
  review: DisplayPromoSlide[];
}

export function emptyDisplayPromos(): DisplayPromos {
  return { qris: [], hotline: [], review: [] };
}

export function isDisplayPromoSlot(value: string): value is DisplayPromoSlot {
  return (DISPLAY_PROMO_SLOTS as readonly string[]).includes(value);
}

export interface CustomerDisplaySnapshot {
  queue: QueueCard[];
  beds: BedCard[];
  bill: CustomerBill | null;
  promos: DisplayPromos;
}
