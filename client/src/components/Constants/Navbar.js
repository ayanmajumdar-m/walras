import React, { useState } from "react";
import "./Constants.css";
import { Search, ShoppingCart, User, HeadphonesIcon, Menu, ChevronDown, X } from "lucide-react";
import Logo from '../../assets/logo.png'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const user = JSON.parse(localStorage.getItem("userId"));

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const mainSections = [
    { 
      name: "Domains", 
      href: "/domains",
      type: "link"
    },
    { 
      name: "Flare Compute", 
      href: "/about/pricing",
      type: "link"
    },
    { 
      name: "Bare Metal", 
      href: "/bare-metal",
      type: "link"
    },
    // {
    //   name: "Flare Mail",
    //   href: "/flare-mail",
    //   type: "link"
    // },
    { 
      name: "Pages", 
      type: "dropdown",
      submenu: [
        { name: "About Us", href: "/about" },
        { name: "Contact Us", href: "/contact" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" }
      ]
    }
  ];

  const mobileLinks = [
    { name: "Domains", href: "/domains" },
    { name: "Flare Compute", href: "/about/pricing" },
    { name: "Bare Metal", href: "/bare-metal" },
    // Pages submenu items
    { name: "About Us", href: "/about" },
    { name: "Contact Us", href: "/contact" },
    { name: "Privacy Policy", href: "/privacy" },
    { name: "Terms of Service", href: "/terms" },
    // Utility links
    { name: "Cart", href: "/cart" },
    { name: "Support", href: "/contact" },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <div className="top-nav-left">
          <a href="/contact" className="logo-container">
            <img src={Logo} width={150} alt="Buttr Cloud Logo" className="logo-image" />
          </a>
        </div>

        <div className="top-nav-center">
          <div className="nav-links">
            {mainSections.map((section) => 
              section.type === "link" ? (
                <a key={section.href} href={"/contact"} className="nav-link">
                  {section.name}
                </a>
              ) : (
                <div key={section.name} className="dropdown">
                  <button className="dropbtn">
                    {section.name}
                    <ChevronDown size={16} className="dropdown-chevron" />
                  </button>
                  <div className="dropdown-content">
                    {section.submenu.map((item) => (
                      <a key={item.href} href={"/contact"}>
                        {item.name}
                      </a>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="top-nav-right">
          {/* <a href="/cart" className="icon-button">
            <ShoppingCart size={24} />
          </a> */}
          <a href="/contact" className="icon-button">
            <HeadphonesIcon size={24} />
            <span>Support</span>
          </a>
          {user ? (
            <a href="/contact" className="icon-button">
              <User size={24} />
              <span>Dashboard</span>
            </a>
          ) : (
            <button
              className="login-btn"
              onClick={() => (window.location.href = "/contact")}
            >
              Login
            </button>
          )}
        </div>

        <button className="mobile-toggle" onClick={toggleMenu} aria-label="Menu">
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}></div>
      )}

      {/* Mobile Menu */}
      <div className={`mobile-menu ${isMenuOpen ? "show" : ""}`}>
        {/* Mobile Menu Header */}
        <div className="mobile-menu-header">
          <div className="mobile-logo">
            <div className="logo-box">SF</div>
            <span className="logo-text">Buttr Cloud</span>
          </div>
          <button className="mobile-close" onClick={closeMenu} aria-label="Close menu">
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Search domains, services..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Mobile Menu Links */}
        <div className="mobile-links">
          {mobileLinks.map((link) => (
            <a 
              key={link.href} 
              href={'/contact'} 
              className="mobile-link"
              onClick={closeMenu}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Mobile Menu Footer */}
        <div className="mobile-menu-footer">
          {user ? (
            <a href="/contact" className="mobile-dashboard-btn" onClick={closeMenu}>
              <User size={20} />
              <span>Dashboard</span>
            </a>
          ) : (
            <button
              className="mobile-login-btn"
              onClick={() => {
                closeMenu();
                window.location.href = "/contact";
              }}
            >
              Login to Account
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;