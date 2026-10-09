import { Layers, Globe, HardDrive, BadgePercent } from "lucide-react";

// The products the console can create, in the order they appear on the
// Overview cards and the Create page rail.
export const PRODUCTS = [
  { id: "compute", Icon: Layers, title: "Virtual Machine", desc: "General purpose VMs on Intel or AMD.", from: "from ₹350/mo", status: "available" },
  // The same VMs, reserved for 3–36 months and paid up front (Create.js, mode "reserved").
  { id: "reserved", Icon: BadgePercent, title: "Reserved VM", desc: "Reserve a VM for 3–36 months and save up to 25%.", from: "Save up to 25%", status: "available" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon", status: "soon" },
  { id: "baremetal", Icon: HardDrive, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon", status: "soon" },
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
  return { label: product.from, available: product.status === "available" };
};
