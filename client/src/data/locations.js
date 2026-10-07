import { useEffect, useState } from "react";

/*
  Server locations named on the site (About, homepage, footer, sign-in), as
  set in Admin → Locations. Fetched once per page load and shared; the
  fallback is shown until it arrives, or if it can't be loaded.
*/
export const DEFAULT_LOCATIONS = [
  { name: "Mumbai", country: "India", note: "Our home region, close to customers across India." },
  { name: "Los Angeles", country: "United States", note: "Our region for customers across the Americas." },
];

let cached = null;
let pending = null;

const fetchLocations = () => {
  if (!pending) {
    pending = fetch("/api/locations")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cached = Array.isArray(d.locations) && d.locations.length ? d.locations : DEFAULT_LOCATIONS;
        return cached;
      })
      .catch(() => {
        pending = null; // try again next time a page asks
        return DEFAULT_LOCATIONS;
      });
  }
  return pending;
};

export const useLocations = () => {
  const [locations, setLocations] = useState(cached || DEFAULT_LOCATIONS);
  useEffect(() => {
    let alive = true;
    fetchLocations().then((l) => { if (alive) setLocations(l); });
    return () => { alive = false; };
  }, []);
  return locations;
};

/** "Mumbai", "Mumbai and Los Angeles", "A, B and C" */
export const joinNames = (names) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// Short country names for compact lines (footer).
const SHORT = { "United States": "US", "United Kingdom": "UK", "United Arab Emirates": "UAE" };
export const shortCountry = (country) => SHORT[country] || country;
