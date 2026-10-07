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

// ── Web Hosting (cPanel) ────────────────────────────────────────────────────
// Monthly only. The server charges one month and provisions 30 days
// (controllers/hosting.controllers.js HOSTING_PRICES), so multi-month terms
// must not be offered until the backend prices and provisions them.
// `total` includes 18% GST and is exactly what the gateway charges.
export const HOSTING_PRICES = {
  Seed: { monthly: 159, gst: 28.62, total: 187.62 },
  Tree: { monthly: 259, gst: 46.62, total: 305.62 }
};

// Web Hosting is withdrawn for now: hidden from the site and the console, and
// the server refuses new hosting (utils/platformSettings.js LOCKED_FAMILIES).
// Customers who already have hosting still see and manage it.
export const WEB_HOSTING_ENABLED = false;

// Same wording as the public purchase page (components/WebHosting/HostingPurchase.js).
export const HOSTING_PLANS = [
  {
    name: "Seed",
    tagline: "Single site and starter projects",
    features: ["1 website hosted", "10 GB SSD storage", "Unlimited bandwidth", "5 professional email accounts", "Free SSL certificate", "24/7 technical support"]
  },
  {
    name: "Tree",
    tagline: "More power for growing and multi-site businesses",
    popular: true,
    features: ["Up to 10 websites hosted", "50 GB SSD storage", "Unlimited bandwidth", "Unlimited email accounts", "Free SSL and domain included", "24/7 priority support and auto-backups"]
  }
];

export const formatINR = (value, digits = 0) =>
  `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
