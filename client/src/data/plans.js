// Shared plan data and formatting for the public site and the console.

// ── Virtual Machine ─────────────────────────────────────────────────────────
// Category: Virtual Machine. Sub-category: General Purpose. Plans and prices
// are managed in Admin → VM plans and come from the server: /api/plans/vm
// (Pricing page) and /api/servers/catalog (console). Each plan runs on one
// CPU type. ram and bandwidth are in GB (ram 0.5 = 512 MB; 1024 GB = 1 TB).
export const CPU_TYPES = [
  { id: "intel", label: "Intel" },
  { id: "amd", label: "AMD" },
];

export const formatRam = (gb) => (gb < 1 ? `${Math.round(gb * 1024)} MB` : `${gb} GB`);
export const formatBandwidth = (gb) => (gb >= 1024 ? `${+(gb / 1024).toFixed(1)} TB` : `${gb} GB`);

export const formatINR = (value, digits = 0) =>
  `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
