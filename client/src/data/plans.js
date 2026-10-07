// One source of truth for plans and prices, shared by the public Pricing page
// and the console's Create page, so the two can never disagree.

// ── Virtual Machine ─────────────────────────────────────────────────────────
// Category: Virtual Machine. Sub-category: General Purpose. Each plan runs on
// one CPU type (Intel or AMD). All plans: 1 IPv4 address, NVMe SSD storage,
// 1 Gbps network. Prices in rupees (usd kept for reference) exclude tax.
// Keep in step with utils/computeStock.js, whose prices are what's charged.
// Stock (what's for sale where) comes from the server, set in admin.
export const CPU_TYPES = [
  { id: "intel", label: "Intel" },
  { id: "amd", label: "AMD" },
];

const HOURS_PER_MONTH = 720;
const vm = (name, cpu, vcpu, ram, storage, bandwidth, monthly, usd) =>
  ({ name, cpu, vcpu, ram, storage, bandwidth, network: 1, monthly, usd, hourly: Math.round((monthly * 100) / HOURS_PER_MONTH) / 100 });

// ram and bandwidth in GB (ram 0.5 = 512 MB; bandwidth 1024 = 1 TB).
export const COMPUTE_PLANS = [
  vm("VMgIN_0.5", "intel", 1, 0.5, 10, 256, 350, 3.5),
  vm("VMgIN_1", "intel", 1, 1, 20, 512, 450, 4.5),
  vm("VMgIN_2", "intel", 1, 2, 40, 1024, 980, 10),
  vm("VMgIN_4", "intel", 2, 4, 60, 2048, 1400, 15),
  vm("VMgIN_8", "intel", 4, 8, 80, 4096, 2400, 25),
  vm("VMgIN_16", "intel", 6, 16, 120, 5120, 4000, 40),
  vm("VMgIN_24", "intel", 8, 24, 160, 8192, 6000, 65),
  vm("VMgIN_32", "intel", 10, 32, 200, 10240, 9000, 95),
  vm("VMgIN_64", "intel", 14, 64, 400, 20480, 12000, 125),
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
