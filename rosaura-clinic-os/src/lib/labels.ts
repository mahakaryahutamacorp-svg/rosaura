export const statusLabel: Record<string, string> = {
  BOOKED: "Dibooking",
  CONFIRMED: "Dikonfirmasi",
  CHECKED_IN: "Sudah datang",
  IN_SERVICE: "Sedang dilayani",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  NO_SHOW: "Tidak datang",
  RESCHEDULED: "Dijadwalkan ulang",
};

export const statusClass: Record<string, string> = {
  BOOKED: "bg-[#f3e6d4] text-[#6d4c3d]",
  CONFIRMED: "bg-[#e5efe4] text-[#2f5d3a]",
  CHECKED_IN: "bg-[#e4eaf5] text-[#2d4570]",
  IN_SERVICE: "bg-[#f8efd4] text-[#7a5b16]",
  COMPLETED: "bg-[#eceae6] text-[#4d463f]",
  CANCELLED: "bg-[#f6e4e1] text-[#8a3d36]",
  NO_SHOW: "bg-[#f3ddd8] text-[#8a3d36]",
  RESCHEDULED: "bg-[#ece7f6] text-[#53407a]",
};

export const roleLabel: Record<string, string> = {
  OWNER: "Owner",
  FRONT_OFFICE: "Front Office",
  CLINICAL: "Klinis",
  WAREHOUSE: "Gudang",
};

export const paymentLabel: Record<string, string> = {
  CASH: "Tunai",
  TRANSFER: "Transfer",
  QRIS: "QRIS",
};

export const invoiceLabel: Record<string, string> = {
  OPEN: "Piutang",
  PAID: "Lunas",
  VOID: "Batal",
};

export function roleNames(roles: string[]) {
  return roles.map((role) => roleLabel[role] ?? role).join(", ");
}
