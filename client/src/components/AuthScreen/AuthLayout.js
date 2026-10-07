import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Wrench } from "lucide-react";
import "./AuthPages.css";
import { useLocations, joinNames } from "../../data/locations";

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

const POINTS = [
  "Cloud servers billed in rupees",
  null, // "Data centers in …", from Admin → Locations
  "24/7 email and ticket support",
];

/**
 * Two-panel frame for every account screen: brand panel on the left (hidden
 * on small screens), the form on the right.
 */
const AuthLayout = ({ title, subtitle, children, footer, ignoreMaintenance = false }) => {
  // During maintenance customer sign-in/sign-up is closed (the API refuses it
  // too). Admin sign-in passes ignoreMaintenance so the panel stays reachable.
  const [maintenance, setMaintenance] = useState(false);
  const locations = useLocations();
  const points = POINTS.map((p) => p ?? `Data centers in ${joinNames(locations.map((l) => l.name))}`);
  useEffect(() => {
    if (ignoreMaintenance) return;
    fetch("/api/settings/public").then((r) => r.json()).then((s) => setMaintenance(Boolean(s.maintenanceMode))).catch(() => {});
  }, [ignoreMaintenance]);

  return (
  <div className="au-page">
    <aside className="au-brand">
      <Link to="/" className="au-brand-logo">
        <img src={LOGO} alt="" />
        <span>Walras Cloud</span>
      </Link>
      <div className="au-brand-body">
        <p className="au-brand-kicker">The Straightforward Cloud</p>
        <h2>Infrastructure that's simple to start and easy to grow.</h2>
        <ul>
          {points.map((p) => (
            <li key={p}><Check aria-hidden="true" />{p}</li>
          ))}
        </ul>
      </div>
      <p className="au-brand-foot">© {new Date().getFullYear()} Walras Cloud</p>
    </aside>

    <main className="au-main">
      <Link to="/" className="au-mobile-logo">
        <img src={LOGO} alt="" />
        <span>Walras Cloud</span>
      </Link>
      <div className="au-panel">
        {maintenance ? (
          <>
            <div className="au-mail-icon"><Wrench aria-hidden="true" /></div>
            <h1 className="au-title">We'll be right back</h1>
            <p className="au-subtitle">
              Walras Cloud is under maintenance, so sign-in and sign-up are paused for a short while.
              Your services keep running. Please check back soon.
            </p>
            <div className="au-footer"><Link to="/">Back to the homepage</Link></div>
          </>
        ) : (
          <>
            <h1 className="au-title">{title}</h1>
            {subtitle && <p className="au-subtitle">{subtitle}</p>}
            {children}
            {footer && <div className="au-footer">{footer}</div>}
          </>
        )}
      </div>
    </main>
  </div>
  );
};

export default AuthLayout;
