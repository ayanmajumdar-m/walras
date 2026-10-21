// Where the site lives. The Dedicated Servers catalog has its own address,
// metal.walras.net, served by this same app: on that host "/" is the catalog
// (App.js) and links back to the rest of the site, the console and sign-in
// go to the main site, where the customer's session is.
export const MAIN_SITE = "https://www.walras.net";
export const METAL_SITE = "https://metal.walras.net";

const host = typeof window !== "undefined" ? window.location.hostname : "";
const local = !host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

/** True on metal.walras.net (or metal.localhost when testing). */
export const isMetalHost = /^metal\./i.test(host);

/** A main-site path, as a link that works from either host. */
export const siteHref = (path) => (isMetalHost && !local ? `${MAIN_SITE}${path}` : path);

/** The Dedicated Servers catalog: its own address in production, a path when testing. */
export const DEDICATED_URL = local ? "/dedicated-servers" : isMetalHost ? "/" : METAL_SITE;
