import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, ArrowLeftRight, FileText, Ticket, Layers, Server, Globe,
  UserCog, ScrollText, Settings as SettingsIcon, LogOut, Menu, X,
} from "lucide-react";
import AdminProtectedRoute from "./AdminPrivateRoute";
import { adminApi, adminLogout } from "./adminApi";
import Customers from "./sections/Customers";
import CustomerDetail from "./sections/CustomerDetail";
import Orders from "./sections/Orders";
import Administrators from "./sections/Administrators";
import AuditLogs from "./sections/AuditLogs";
import PlatformSettings from "./sections/PlatformSettings";
import NotificationsBell from "./sections/NotificationsBell";
import {
  DashboardSection, TransactionsSection, InvoicesSection, PromoCodesSection,
  ServersSection, HostingSection, DomainsSection,
} from "./sections/Legacy";
// AdminDashboard.css still styles the pre-existing views (Dashboard,
// Transactions, Invoices, …); the console + admin sheets come after it.
import "./AdminDashboard.css";
// Users.css outlived the old Users view: its .modal* rules style the promo
// form and the console's nameserver/transfer dialogs.
import "./components/Users.css";
import "../ProtectedRoutes/Console.css";
import "./AdminConsole.css";

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";

// Sidebar, grouped like Fantom's "Vestige Root": operations, then governance.
const GROUPS = [
  {
    label: "Operations",
    items: [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, perm: "view_dashboard" },
      { id: "customers", label: "Customers", Icon: Users, perm: "view_users" },
      { id: "orders", label: "Orders", Icon: Receipt, perm: "view_billing" },
      { id: "transactions", label: "Transactions", Icon: ArrowLeftRight, perm: "view_billing" },
      { id: "invoices", label: "Invoices", Icon: FileText, perm: "view_billing" },
      { id: "promo-codes", label: "Promo codes", Icon: Ticket, perm: ["manage_coupons", "view_billing"] },
      { id: "hosting", label: "Web hosting", Icon: Server, perm: "view_services" },
      { id: "servers", label: "Cloud servers", Icon: Layers, perm: "view_services" },
      { id: "domains", label: "Domains", Icon: Globe, perm: "view_services" },
    ],
  },
  {
    label: "Governance",
    items: [
      { id: "admins", label: "Administrators", Icon: UserCog, perm: "manage_admins" },
      { id: "audit", label: "Audit logs", Icon: ScrollText, perm: "view_audit_logs" },
      { id: "settings", label: "Settings", Icon: SettingsIcon, perm: "manage_settings" },
    ],
  },
];

const ROLE_LABELS = { super_admin: "Super admin", admin: "Admin", support: "Support", finance: "Finance", readonly: "Read only" };

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    adminApi("/me").then(setMe).catch((e) => setError(e.message));
  }, []);

  const can = useCallback(
    (perm) => {
      const have = me?.permissions || [];
      return (Array.isArray(perm) ? perm : [perm]).some((p) => have.includes(p));
    },
    [me]
  );

  const visibleGroups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length);
  const firstSection = visibleGroups[0]?.items[0]?.id;
  const requested = params.get("section");
  const allowed = visibleGroups.flatMap((g) => g.items).some((i) => i.id === requested) || (requested === "customer" && can("view_users"));
  const section = allowed ? requested : firstSection;
  const customerId = params.get("id");

  const go = (id, extra = {}) => {
    setNotice(null);
    setParams({ section: id, ...extra });
    setMenuOpen(false);
    window.scrollTo(0, 0);
  };
  const openCustomer = (id) => go("customer", { id: String(id) });
  const notify = (text, type = "success") => setNotice({ text, type });

  const render = () => {
    switch (section) {
      case "dashboard": return <DashboardSection />;
      case "customers": return <Customers openCustomer={openCustomer} />;
      case "customer": return (
        <CustomerDetail key={customerId} userId={customerId} can={can}
          onBack={(msg) => { go("customers"); if (typeof msg === "string") notify(msg); }} />
      );
      case "orders": return <Orders openCustomer={openCustomer} />;
      case "transactions": return <TransactionsSection />;
      case "invoices": return <InvoicesSection can={can} notify={notify} />;
      case "promo-codes": return <PromoCodesSection notify={notify} />;
      case "hosting": return <HostingSection notify={notify} />;
      case "servers": return <ServersSection />;
      case "domains": return <DomainsSection />;
      case "admins": return <Administrators me={me} />;
      case "audit": return <AuditLogs openCustomer={openCustomer} />;
      case "settings": return <PlatformSettings />;
      default: return <div className="cx-card cx-empty"><h4>No sections available</h4><p>Your role doesn't include any admin permissions. Ask a super admin.</p></div>;
    }
  };

  const activeNav = section === "customer" ? "customers" : section;

  return (
    <AdminProtectedRoute>
      <div className="cx-shell ap-shell">
        {menuOpen && <div className="cx-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
        <aside className={`cx-sidebar${menuOpen ? " is-open" : ""}`}>
          <div className="cx-brand">
            <a href="/" className="cx-brand-link"><img src={LOGO} alt="" /><span>Walras Cloud</span></a>
            <button type="button" className="cx-close-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button>
          </div>
          <span className="cx-kicker">Admin panel</span>

          <nav className="cx-nav" aria-label="Admin">
            {visibleGroups.map((g, gi) => (
              <React.Fragment key={g.label}>
                {gi > 0 && <span className="cx-nav-sep" aria-hidden="true" />}
                <span className="ap-nav-label">{g.label}</span>
                {g.items.map(({ id, label, Icon }) => (
                  <button key={id} type="button" className={`cx-nav-item ap-nav-btn${activeNav === id ? " is-active" : ""}`} onClick={() => go(id)}>
                    <Icon size={18} aria-hidden="true" /><span>{label}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>

          <div className="cx-user">
            <span className="cx-avatar" aria-hidden="true">{(me?.fullName || me?.username || "A").slice(0, 1).toUpperCase()}</span>
            <span className="cx-user-text">
              <strong>{me?.fullName || me?.username || "Admin"}</strong>
              <small>{ROLE_LABELS[me?.role] || ""}</small>
            </span>
            <button type="button" className="cx-logout" onClick={adminLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
        </aside>

        <div className="cx-main">
          <header className="cx-topbar">
            <button type="button" className="cx-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
            <h1 className="cx-topbar-title">
              {section === "customer" ? "Customer" : visibleGroups.flatMap((g) => g.items).find((i) => i.id === section)?.label || "Admin"}
            </h1>
            <div className="cx-topbar-actions">
              {me && <NotificationsBell openCustomer={openCustomer} />}
              {me && <span className="cx-pill is-brand ap-role-pill">{ROLE_LABELS[me.role]}</span>}
            </div>
          </header>

          <main className="cx-content">
            {error && <div className="cx-alert is-error">{error}</div>}
            {notice && (
              <div className={`cx-alert is-${notice.type} ap-page-notice`} role="status">
                {notice.text}
                <button type="button" className="cx-icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button>
              </div>
            )}
            {me ? render() : !error && <div className="cx-card cx-empty"><p>Loading…</p></div>}
          </main>
        </div>
      </div>
    </AdminProtectedRoute>
  );
};

export default AdminDashboard;
