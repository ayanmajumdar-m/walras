import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, PlusSquare, Boxes, CreditCard, LifeBuoy, UserCircle, LogOut, X, ChevronsUpDown, Check, BadgePercent } from "lucide-react";
import { switchAccount, ACCOUNT_KEY } from "./consoleApi";

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

const NAV = [
  { to: "/dashboard/home", label: "Overview", Icon: LayoutGrid },
  { to: "/dashboard/create", label: "Create", Icon: PlusSquare, perm: "servers" },
  { to: "/dashboard/create?type=reserved", label: "Reserve & Save", Icon: BadgePercent, perm: "servers" },
  { to: "/dashboard/resources", label: "Resources", Icon: Boxes, perm: "servers" },
  { to: "/dashboard/billing", label: "Billing", Icon: CreditCard, perm: "billing" },
];

const NAV_SECONDARY = [
  { to: "/dashboard/support", label: "Support", Icon: LifeBuoy, perm: "support" },
  { to: "/dashboard/profile", label: "Account", Icon: UserCircle },
];

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "W";

// Which account the console works in: your own, or a team you belong to.
const ROLE_LABELS = { write: "Write", admin: "Admin" };
const AREA_LABELS = { servers: "Servers", billing: "Billing", support: "Support" };

const AccountSwitcher = ({ profile, account, memberships }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const options = [
    { id: null, name: "My account", sub: profile?.email || "Your own resources" },
    ...memberships.map((m) => ({
      id: String(m.ownerId),
      name: m.company || m.ownerName || m.ownerEmail,
      sub: `${ROLE_LABELS[m.role] || "Write"} · ${(m.areas || []).map((a) => AREA_LABELS[a] || a).join(", ")}`,
    })),
  ];
  const current = options.find((o) => o.id === (account ? String(account.ownerId) : null)) || options[0];

  const pick = (id) => {
    setOpen(false);
    if (id !== current.id) switchAccount(id);
  };

  return (
    <div className="cx-account" ref={ref}>
      <span className="cx-account-label">Account</span>
      <button type="button" className={`cx-account-btn${open ? " is-open" : ""}`} onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox" aria-expanded={open}>
        <span className="cx-account-avatar" aria-hidden="true">{initials(current.name)}</span>
        <span className="cx-account-text">
          <strong>{current.name}</strong>
          <small>{current.id ? "Team account" : "Personal"}</small>
        </span>
        <ChevronsUpDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className="cx-account-menu" role="listbox" aria-label="Switch account">
          {options.map((o) => (
            <li key={o.id || "own"} role="option" aria-selected={o.id === current.id}>
              <button type="button" className={o.id === current.id ? "is-current" : ""} onClick={() => pick(o.id)}>
                <span className="cx-account-avatar" aria-hidden="true">{initials(o.name)}</span>
                <span className="cx-account-text">
                  <strong>{o.name}</strong>
                  <small>{o.sub}</small>
                </span>
                {o.id === current.id && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Sidebar = ({ open, onClose, profile, account, memberships = [], can = () => true }) => {
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem(ACCOUNT_KEY);
    window.location.href = "/login";
  };

  // Create and "Reserve & Save" share a path; the ?type= tells them apart.
  const { search } = useLocation();
  const onReserve = new URLSearchParams(search).get("type") === "reserved";
  const link = ({ to, label, Icon }) => (
    <NavLink key={to} to={to} className={({ isActive }) => {
      const active = to.includes("type=reserved") ? isActive && onReserve : to === "/dashboard/create" ? isActive && !onReserve : isActive;
      return `cx-nav-item${active ? " is-active" : ""}`;
    }}>
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

        {memberships.length > 0 && <AccountSwitcher profile={profile} account={account} memberships={memberships} />}

        <nav className="cx-nav" aria-label="Console">
          {NAV.filter((n) => !n.perm || can(n.perm)).map(link)}
          <span className="cx-nav-sep" aria-hidden="true" />
          {NAV_SECONDARY.filter((n) => !n.perm || can(n.perm)).map(link)}
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
