// One source of truth for plans and prices, shared by the public Pricing page
// and the console's Create page, so the two can never disagree.

// ── Cloud Compute ───────────────────────────────────────────────────────────
// All plans: 1 IPv4 address, DDR4 RAM, SSD storage, transfer @10 Gbps.
// Keep in step with utils/computeStock.js, whose prices are what's charged.
// Stock (what's for sale where) comes from the server, set in admin.
export const COMPUTE_PLANS = [
  { name: "WSC-4GB", vcpu: 2, ram: 4, storage: 60, bandwidth: 2, monthly: 900, hourly: 1.25, popular: false },
  { name: "SFC-8GB", vcpu: 4, ram: 8, storage: 120, bandwidth: 4, monthly: 1800, hourly: 2.5, popular: false },
  { name: "SFC-16GB", vcpu: 6, ram: 16, storage: 240, bandwidth: 6, monthly: 3600, hourly: 5, popular: true },
  { name: "SFC-32GB", vcpu: 10, ram: 32, storage: 480, bandwidth: 10, monthly: 5400, hourly: 7.5, popular: false }
];

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
