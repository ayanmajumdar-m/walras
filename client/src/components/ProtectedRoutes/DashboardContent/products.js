import { Layers, Server, Globe, HardDrive } from "lucide-react";
import { WEB_HOSTING_ENABLED } from "../../../data/plans";

// The products the console can create, in the order they appear on the
// Overview cards and the Create page rail.
const ALL_PRODUCTS = [
  { id: "hosting", Icon: Server, title: "Web Hosting", desc: "cPanel hosting with free SSL and email.", from: "from ₹159/mo", status: "available" },
  { id: "compute", Icon: Layers, title: "Cloud Compute", desc: "Virtual machines for apps and workloads.", from: "from ₹900/mo", status: "available" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon", status: "soon" },
  { id: "baremetal", Icon: HardDrive, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon", status: "soon" },
];

export const PRODUCTS = ALL_PRODUCTS.filter((p) => p.id !== "hosting" || WEB_HOSTING_ENABLED);

// Live status for a product card/tab: Web Hosting reads "Out of stock" when
// the admin has every hosting plan (or all plans) out of stock.
export const productStatus = (product, platform) => {
  if (product.id === "hosting") {
    const hosting = platform?.planAvailability?.hosting;
    if (hosting && !Object.values(hosting).some(Boolean)) return { label: "Out of stock", available: false };
  }
  // Cloud Compute sells against stock set in admin (per plan per location).
  if (product.id === "compute") {
    const compute = platform?.planAvailability?.compute;
    if (!compute || !Object.values(compute).some(Boolean)) return { label: "Out of stock", available: false };
  }
  return { label: product.from, available: product.status === "available" };
};
