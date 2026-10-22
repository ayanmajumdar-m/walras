// Where the site lives. The Dedicated catalog has its own address,
// metal.walras.net, served by this same app: on that host "/" is the catalog
// (App.js) and links back to the rest of the site, the console and sign-in
// go to the main site, where the customer's session is.
export const MAIN_SITE = "https://www.walras.net";
export const METAL_SITE = "https://metal.walras.net";

const host = typeof window !== "undefined" ? window.location.hostname : "";
const local = !host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");

/** True on metal.walras.net (or metal.localhost when testing). */
export const isMetalHost = /^metal\./i.test(host);

/** The main site's address: www.walras.net, or localhost:<port> when testing. */
export const MAIN_ORIGIN = local && typeof window !== "undefined"
  ? `${window.location.protocol}//localhost${window.location.port ? `:${window.location.port}` : ""}`
  : MAIN_SITE;

/**
 * A main-site path, as a link that works from either host. metal.walras.net
 * shows only the catalog, so from there every other page is on the main site
 * (the server redirects there too, index.js).
 */
export const siteHref = (path) => (isMetalHost ? `${MAIN_ORIGIN}${path}` : path);

/** The Dedicated catalog: its own address in production, a path when testing. */
export const DEDICATED_URL = isMetalHost ? "/" : local ? "/dedicated" : METAL_SITE;
