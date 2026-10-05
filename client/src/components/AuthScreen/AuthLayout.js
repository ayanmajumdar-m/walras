import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import "./AuthPages.css";

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

const POINTS = [
  "Cloud servers billed in rupees",
  "Data centers in Mumbai and London",
  "24/7 email and ticket support",
];

/**
 * Two-panel frame for every account screen: brand panel on the left (hidden
 * on small screens), the form on the right.
 */
const AuthLayout = ({ title, subtitle, children, footer }) => (
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
          {POINTS.map((p) => (
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
        <h1 className="au-title">{title}</h1>
        {subtitle && <p className="au-subtitle">{subtitle}</p>}
        {children}
        {footer && <div className="au-footer">{footer}</div>}
      </div>
    </main>
  </div>
);

export default AuthLayout;
