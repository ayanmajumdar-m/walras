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

// ── Managed Database ────────────────────────────────────────────────────────
// General Purpose plans (Admin → Managed Database → Plans), from
// /api/plans/database (Pricing page) and /api/databases/catalog (console).
// The engine is chosen per database and doesn't change the price.
// Storage below 1 GB is shown in MB (0.5 = 500 MB); vCPU can be a fraction.
export const DB_ENGINES = [
  { id: "mysql", label: "MySQL" },
  { id: "postgresql", label: "PostgreSQL" },
];
export const formatStorage = (gb) => (gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb} GB`);
export const formatBackups = (days) => (days > 0 ? `Daily, ${days}-day retention` : "None");

// ── App Platform ────────────────────────────────────────────────────────────
// Plans (Admin → App Platform → Plans) from /api/plans/apps and
// /api/apps/catalog. Shared is on sale; Dedicated is coming soon.
export const APP_TYPES = [
  { id: "shared", label: "Shared", available: true },
  { id: "dedicated", label: "Dedicated", available: false },
];
