import { Layers, Globe, HardDrive, BadgePercent, Database, Rocket } from "lucide-react";

// The products the console can create, in the order they appear on the
// Overview cards. `to` is where each opens: Reserved VM has its own page
// (Reserve.js); the rest are tabs on the Create page.
export const PRODUCTS = [
  { id: "compute", Icon: Layers, title: "Virtual Machine", desc: "General purpose VMs on Intel or AMD.", from: "from ₹350/mo", status: "available", to: "/dashboard/create?type=compute" },
  // The same VMs, reserved for 3–36 months and paid up front (Reserve.js).
  { id: "reserved", Icon: BadgePercent, title: "Reserved VM", desc: "Reserve a VM for 3–36 months and save up to 25%.", from: "Save up to 25%", status: "available", to: "/dashboard/reserve" },
  { id: "database", Icon: Database, title: "Managed Database", desc: "MySQL or PostgreSQL with daily backups.", from: "from ₹199/mo", status: "available", to: "/dashboard/create?type=database" },
  { id: "apps", Icon: Rocket, title: "App Platform", desc: "Deploy your app on your own domain.", from: "from ₹349/mo", status: "available", to: "/dashboard/create?type=apps" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon", status: "soon", to: "/dashboard/create?type=domains" },
  { id: "baremetal", Icon: HardDrive, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon", status: "soon", to: "/dashboard/create?type=baremetal" },
];

// Live status for a product card/tab.
export const productStatus = (product, platform) => {
  // Virtual Machines (monthly or reserved) sell against stock set in admin (per plan per location).
  if (product.id === "compute" || product.id === "reserved") {
    const compute = platform?.planAvailability?.compute;
    if (!compute || !Object.values(compute).some(Boolean)) return { label: "Out of stock", available: false };
    if (product.id === "reserved") return { label: product.from, available: true };
    // Cheapest active plan (plans and prices are managed in admin).
    if (platform?.vmFromPrice) return { label: `from ₹${Number(platform.vmFromPrice).toLocaleString("en-IN")}/mo`, available: true };
  }
  // Managed Databases: the same, with their own plans and stock.
  if (product.id === "database") {
    const db = platform?.planAvailability?.database;
    if (!db || !Object.values(db).some(Boolean)) return { label: "Out of stock", available: false };
    if (platform?.dbFromPrice) return { label: `from ₹${Number(platform.dbFromPrice).toLocaleString("en-IN")}/mo`, available: true };
  }
  // App Platform: no stock; on sale while it has plans.
  if (product.id === "apps") {
    if (!platform?.appFromPrice) return { label: "Coming soon", available: false };
    return { label: `from ₹${Number(platform.appFromPrice).toLocaleString("en-IN")}/mo`, available: true };
  }
  return { label: product.from, available: product.status === "available" };
};
