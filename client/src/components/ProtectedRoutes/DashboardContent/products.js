import { Layers, Server, Globe, HardDrive } from "lucide-react";

// The products the console can create, in the order they appear on the
// Overview cards and the Create page rail.
export const PRODUCTS = [
  { id: "hosting", Icon: Server, title: "Web Hosting", desc: "cPanel hosting with free SSL and email.", from: "from ₹159/mo", status: "available" },
  { id: "compute", Icon: Layers, title: "Cloud Compute", desc: "Virtual machines for apps and workloads.", from: "Out of stock", status: "soldout" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon", status: "soon" },
  { id: "baremetal", Icon: HardDrive, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon", status: "soon" },
];
