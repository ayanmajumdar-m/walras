import React, { useState } from "react";
import "./Constants.css";
import { HeadphonesIcon, Menu, X } from "lucide-react";
import Logo from "../logo.png";

/*
  The header is a hairline rule with three zones: mark, sections, actions.
  The active section is marked with a 2px brand underline — the same yellow
  that fills the primary button, so "where I am" and "what I can do" read as
  one colour and nothing else competes.
*/

const SECTIONS = [
  { name: "Domains", href: "/domains" },
  { name: "Flare Compute", href: "/about/pricing" },
  { name: "Bare Metal", href: "/bare-metal" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" }
];

const MOBILE_LINKS = [
  ...SECTIONS,
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
  { name: "Support", href: "/contact" }
];

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem("userId"));
  const path = typeof window !== "undefined" ? window.location.pathname : "/";

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <a href="/" className="logo-container">
            <img src={Logo} width={118} alt="Buttr Cloud" className="logo-image" />
          </a>

          <nav className="nav-links">
            {SECTIONS.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className={`nav-link${path === section.href ? " is-active" : ""}`}
              >
                {section.name}
              </a>
            ))}
          </nav>

          <div className="top-nav-right">
            <a href="/contact" className="btn btn-secondary nav-support">
              <HeadphonesIcon size={16} strokeWidth={1.5} />
              <span>Support</span>
            </a>
            {user ? (
              <a href="/dashboard" className="btn btn-primary">Console</a>
            ) : (
              <a href="/login" className="btn btn-primary">Console</a>
            )}
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
          <a href={user ? "/dashboard" : "/login"} className="btn btn-primary btn-block" onClick={closeMenu}>
            Console
          </a>
        </div>
      </div>
    </>
  );
};

export default Navbar;
