export const plans = [
  { id: 'month_1', label: '1 Bulan', amount: 299000, months: 1, duration: '30 hari' },
  { id: 'month_3', label: '3 Bulan', amount: 749000, months: 3, duration: '3 bulan' },
  { id: 'month_6', label: '6 Bulan', amount: 1399000, months: 6, duration: '6 bulan' },
  { id: 'year_1', label: '1 Tahun', amount: 2499000, months: 12, duration: '12 bulan', featured: true },
  { id: 'lifetime', label: 'Lifetime', amount: 15000000, months: null, duration: 'Selamanya', featured: true },
];

export const branchAddons = [
  { months: 1, label: '1 bulan', pricePerBranch: 100000 },
  { months: 3, label: '3 bulan', pricePerBranch: 150000 },
  { months: 6, label: '6 bulan', pricePerBranch: 250000 },
  { months: 12, label: '12 bulan', pricePerBranch: 500000 },
  { months: 0, label: 'Lifetime', pricePerBranch: 2000000 },
];

export function getBranchAddon(months) {
  return branchAddons.find((addon) => addon.months === Number(months)) ?? null;
}
