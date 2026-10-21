import React, { useState } from "react";
import "./Constants.css";
import { HeadphonesIcon, Menu, X } from "lucide-react";
import { DEDICATED_URL, isMetalHost, siteHref } from "../../data/site";
const Logo = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

/*
  The header is a hairline rule with three zones: mark, sections, actions.
  The active section is marked with a 2px brand underline — the same yellow
  that fills the primary button, so "where I am" and "what I can do" read as
  one colour and nothing else competes.
*/

// Domains, Virtual Machines and Managed Database all live on the one Pricing page.
// Dedicated Servers has its own site, metal.walras.net (data/site.js).
const SECTIONS = [
  { name: "Pricing", href: siteHref("/pricing") },
  { name: "Dedicated Servers", href: DEDICATED_URL, dedicated: true },
  { name: "About", href: siteHref("/about") },
  { name: "Contact", href: siteHref("/contact") }
];

const MOBILE_LINKS = [
  ...SECTIONS,
  { name: "Privacy Policy", href: siteHref("/privacy") },
  { name: "Terms of Service", href: siteHref("/terms") },
  { name: "Support", href: siteHref("/contact") }
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  let user = null;
  try {
    const storedUser = localStorage.getItem("userId");
    user = storedUser ? (storedUser.startsWith("{") || storedUser.startsWith("[") ? JSON.parse(storedUser) : storedUser) : null;
  } catch (e) {
    user = localStorage.getItem("userId");
  }
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isActive = (section) => (section.dedicated ? isMetalHost || path === "/dedicated-servers" : !isMetalHost && path === section.href);
  const consoleHref = siteHref(user ? "/dashboard" : "/login");

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href={siteHref("/")} className="logo-container">
            <img src={Logo} height={52} alt="Walras Cloud" className="logo-image" />
          </a>

          <nav className="nav-links">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className={`nav-link${isActive(section) ? " is-active" : ""}`}
              >
                {section.name}
              </a>
            ))}
          </nav>

          <div className="top-nav-right">
            <a href={siteHref("/contact")} className="btn btn-secondary nav-support">
              <HeadphonesIcon size={16} strokeWidth={1.5} />
              <span>Support</span>
            </a>
            <a href={consoleHref} className="btn btn-primary">Console</a>
          </div>

          <button
            className="mobile-toggle"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Menu"
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {isMenuOpen && <div className="mobile-menu-overlay" onClick={closeMenu} />}

      <div className={`mobile-menu${isMenuOpen ? " show" : ""}`}>
        <div className="mobile-menu-header">
          <span className="kicker">Menu</span>
          <button className="mobile-close" onClick={closeMenu} aria-label="Close menu">
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mobile-links">
          {MOBILE_LINKS.map((link) => (
            <a key={link.href + link.name} href={link.href} className="mobile-link" onClick={closeMenu}>
              {link.name}
            </a>
          ))}
        </div>

        <div className="mobile-menu-footer">
          <a href={consoleHref} className="btn btn-primary btn-block" onClick={closeMenu}>
            Console
          </a>
        </div>
      </div>
    </>
  );
};

export default Navbar;
