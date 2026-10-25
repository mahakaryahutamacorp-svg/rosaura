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

export interface CustomerDisplaySnapshot {
  queue: QueueCard[];
  beds: BedCard[];
  bill: CustomerBill | null;
}
