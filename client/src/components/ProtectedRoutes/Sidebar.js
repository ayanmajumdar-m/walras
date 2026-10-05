import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutGrid, PlusSquare, Boxes, CreditCard, LifeBuoy, UserCircle, LogOut, X } from "lucide-react";

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

const NAV = [
  { to: "/dashboard/home", label: "Overview", Icon: LayoutGrid },
  { to: "/dashboard/create", label: "Create", Icon: PlusSquare },
  { to: "/dashboard/resources", label: "Resources", Icon: Boxes },
  { to: "/dashboard/billing", label: "Billing", Icon: CreditCard },
];

const NAV_SECONDARY = [
  { to: "/dashboard/submitTicket", label: "Support", Icon: LifeBuoy },
  { to: "/dashboard/profile", label: "Account", Icon: UserCircle },
];

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "W";

const Sidebar = ({ open, onClose, profile }) => {
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.href = "/login";
  };

  const link = ({ to, label, Icon }) => (
    <NavLink key={to} to={to} className={({ isActive }) => `cx-nav-item${isActive ? " is-active" : ""}`}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <>
      {open && <div className="cx-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`cx-sidebar${open ? " is-open" : ""}`}>
        <div className="cx-brand">
          <a href="/" className="cx-brand-link">
            <img src={LOGO} alt="" />
            <span>Walras Cloud</span>
          </a>
          <button type="button" className="cx-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <span className="cx-kicker">Console</span>

        <nav className="cx-nav" aria-label="Console">
          {NAV.map(link)}
          <span className="cx-nav-sep" aria-hidden="true" />
          {NAV_SECONDARY.map(link)}
        </nav>

        <div className="cx-user">
          <span className="cx-avatar" aria-hidden="true">{initials(profile?.name)}</span>
          <span className="cx-user-text">
            <strong>{profile?.name || "Your account"}</strong>
            <small>{profile?.email || ""}</small>
          </span>
          <button type="button" className="cx-logout" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
