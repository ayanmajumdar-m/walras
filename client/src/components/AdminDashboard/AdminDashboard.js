import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutDashboard, Users, Receipt, ArrowLeftRight, FileText, Ticket, Layers, Server, Globe,
  UserCog, ScrollText, Settings as SettingsIcon, LogOut, Menu, X, Boxes, Mail, Tags, MapPin, Cloud,
  Package, Wallet, Megaphone, ChevronDown, LifeBuoy, PhoneCall, MessageSquare, Database, Rocket,
} from "lucide-react";
import AdminProtectedRoute from "./AdminPrivateRoute";
import { adminApi, adminLogout } from "./adminApi";
import Customers from "./sections/Customers";
import CustomerDetail from "./sections/CustomerDetail";
import Orders from "./sections/Orders";
import Administrators from "./sections/Administrators";
import AuditLogs from "./sections/AuditLogs";
import PlatformSettings from "./sections/PlatformSettings";
import ComputeStock from "./sections/ComputeStock";
import VmPlans from "./sections/VmPlans";
import Locations from "./sections/Locations";
import SolusAccounts from "./sections/SolusAccounts";
import MonthlyInvoices from "./sections/MonthlyInvoices";
import BulkEmail from "./sections/BulkEmail";
import SupportPlus from "./sections/SupportPlus";
import DbDatabases from "./sections/DbDatabases";
import DbPlans from "./sections/DbPlans";
import DbStock from "./sections/DbStock";
import Apps from "./sections/Apps";
import AppPlans from "./sections/AppPlans";
import AppStock from "./sections/AppStock";
import Tickets from "./sections/Tickets";
import NotificationsBell from "./sections/NotificationsBell";
import {
  DashboardSection, TransactionsSection, PromoCodesSection,
  ServersSection, DomainsSection,
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

// Sidebar: top-level pages, Products (one page with tabs), and Billing /
// Marketing as expandable sub-menus; Governance stays a group of its own.
//   { id, label, Icon, perm }             a page
//   { id, label, Icon, children: [...] }  a sub-menu of pages
//   { id, label, Icon, tabs: [...] }      one page whose sections are tabs
const NAV = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, perm: "view_dashboard" },
  { id: "customers", label: "Customers", Icon: Users, perm: "view_users" },
  {
    id: "products", label: "Products", Icon: Package,
    tabs: [
      {
        id: "vm", label: "Virtual Machines", Icon: Layers,
        items: [
          { id: "servers", label: "Servers", title: "Virtual Machines", Icon: Server, perm: "view_services" },
          { id: "vm-plans", label: "Plans", title: "VM plans", Icon: Tags, perm: "view_services" },
          { id: "locations", label: "Locations", Icon: MapPin, perm: "view_services" },
          { id: "compute-stock", label: "Stock", title: "VM stock", Icon: Boxes, perm: "view_services" },
          { id: "solus-accounts", label: "SolusVM accounts", Icon: Cloud, perm: "view_services" },
        ],
      },
      {
        id: "db", label: "Managed Database", Icon: Database,
        items: [
          { id: "databases", label: "Databases", title: "Managed Databases", Icon: Database, perm: "view_services" },
          { id: "db-plans", label: "Plans", title: "Database plans", Icon: Tags, perm: "view_services" },
          { id: "db-stock", label: "Stock", title: "Database stock", Icon: Boxes, perm: "view_services" },
        ],
      },
      {
        id: "app", label: "App Platform", Icon: Rocket,
        items: [
          { id: "apps", label: "Apps", title: "App Platform apps", Icon: Rocket, perm: "view_services" },
          { id: "app-plans", label: "Plans", title: "App Platform plans", Icon: Tags, perm: "view_services" },
          { id: "app-stock", label: "Stock", title: "App Platform stock", Icon: Boxes, perm: "view_services" },
        ],
      },
      { id: "domain", label: "Domains", Icon: Globe, items: [{ id: "domains", label: "Domains", Icon: Globe, perm: "view_services" }] },
    ],
  },
  {
    id: "billing", label: "Billing", Icon: Wallet,
    children: [
      { id: "orders", label: "Orders", Icon: Receipt, perm: "view_billing" },
      { id: "transactions", label: "Transactions", Icon: ArrowLeftRight, perm: "view_billing" },
      { id: "invoices", label: "Invoices", Icon: FileText, perm: "view_billing" },
      { id: "promo-codes", label: "Promo codes", Icon: Ticket, perm: ["manage_coupons", "view_billing"] },
    ],
  },
  {
    id: "support", label: "Support", Icon: LifeBuoy,
    children: [
      { id: "tickets", label: "Tickets", title: "Support tickets", Icon: MessageSquare, perm: "view_tickets" },
      { id: "support-plus", label: "Support +", title: "Support + call-backs", Icon: PhoneCall, perm: "manage_callbacks" },
    ],
  },
  {
    id: "marketing", label: "Marketing", Icon: Megaphone,
    children: [{ id: "bulk-email", label: "Bulk email", title: "Email customers", Icon: Mail, perm: "send_bulk_email" }],
  },
  {
    id: "governance", label: "Governance", group: true,
    children: [
      { id: "admins", label: "Administrators", Icon: UserCog, perm: "manage_admins" },
      { id: "audit", label: "Audit logs", Icon: ScrollText, perm: "view_audit_logs" },
      { id: "settings", label: "Settings", Icon: SettingsIcon, perm: "manage_settings" },
    ],
  },
];

// Every page (leaf) under an entry, in order.
const leaves = (e) => (e.tabs ? e.tabs.flatMap((t) => t.items) : e.children ? e.children : [e]);

const ROLE_LABELS = { super_admin: "Super admin", admin: "Admin", support: "Support", finance: "Finance", readonly: "Read only" };

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [expanded, setExpanded] = useState({}); // sub-menu id -> open

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

  // The menu with only what this admin may open; empty entries drop out.
  const nav = NAV.map((e) => {
    if (e.tabs) {
      const tabs = e.tabs.map((t) => ({ ...t, items: t.items.filter((i) => can(i.perm)) })).filter((t) => t.items.length);
      return tabs.length ? { ...e, tabs } : null;
    }
    if (e.children) {
      const children = e.children.filter((i) => can(i.perm));
      return children.length ? { ...e, children } : null;
    }
    return can(e.perm) ? e : null;
  }).filter(Boolean);
  const pages = nav.flatMap(leaves);
  const firstSection = pages[0]?.id;
  const requested = params.get("section");
  const allowed = pages.some((i) => i.id === requested) || (requested === "customer" && can("view_users"));
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
      case "invoices": return <MonthlyInvoices can={can} openCustomer={openCustomer} />;
      case "promo-codes": return <PromoCodesSection notify={notify} />;
      case "servers": return <ServersSection />;
      case "vm-plans": return <VmPlans can={can} />;
      case "locations": return <Locations can={can} />;
      case "compute-stock": return <ComputeStock can={can} />;
      case "solus-accounts": return <SolusAccounts can={can} />;
      case "databases": return <DbDatabases can={can} openCustomer={openCustomer} />;
      case "db-plans": return <DbPlans can={can} />;
      case "db-stock": return <DbStock can={can} />;
      case "apps": return <Apps openCustomer={openCustomer} />;
      case "app-plans": return <AppPlans can={can} />;
      case "app-stock": return <AppStock can={can} />;
      case "tickets": return <Tickets openCustomer={openCustomer} />;
      case "support-plus": return <SupportPlus openCustomer={openCustomer} />;
      case "bulk-email": return <BulkEmail />;
      case "domains": return <DomainsSection />;
      case "admins": return <Administrators me={me} />;
      case "audit": return <AuditLogs openCustomer={openCustomer} />;
      case "settings": return <PlatformSettings />;
      default: return <div className="cx-card cx-empty"><h4>No sections available</h4><p>Your role doesn't include any admin permissions. Ask a super admin.</p></div>;
    }
  };

  const activeNav = section === "customer" ? "customers" : section;
  const activeParent = nav.find((e) => (e.tabs || e.children) && leaves(e).some((i) => i.id === activeNav));
  const page = pages.find((i) => i.id === section);

  // Sub-menus: the one holding the open page starts expanded; others toggle.
  const isOpen = (e) => expanded[e.id] ?? activeParent?.id === e.id;
  const toggle = (e) => setExpanded((x) => ({ ...x, [e.id]: !isOpen(e) }));

  const navButton = ({ id, label, Icon }, extra = "") => (
    <button key={id} type="button" className={`cx-nav-item ap-nav-btn${extra}${activeNav === id ? " is-active" : ""}`} onClick={() => go(id)}>
      <Icon size={18} aria-hidden="true" /><span>{label}</span>
    </button>
  );

  // Products: tabs across the top of the page, then the open tab's sections.
  const productTabs = () => {
    const tab = activeParent.tabs.find((t) => t.items.some((i) => i.id === section));
    return (
      <div className="ap-product-tabs">
        <div className="cx-tabs" role="tablist">
          {activeParent.tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t === tab} className={`cx-tab${t === tab ? " is-active" : ""}`}
              onClick={() => t !== tab && go(t.items[0].id)}>
              <t.Icon size={16} aria-hidden="true" />{t.label}
            </button>
          ))}
        </div>
        {tab.items.length > 1 && (
          <div className="ap-subtabs" role="tablist">
            {tab.items.map((i) => (
              <button key={i.id} type="button" role="tab" aria-selected={i.id === section} className={`ap-subtab${i.id === section ? " is-active" : ""}`}
                onClick={() => go(i.id)}>
                {i.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

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
            {nav.map((e) => {
              if (e.group) {
                return (
                  <React.Fragment key={e.id}>
                    <span className="cx-nav-sep" aria-hidden="true" />
                    <span className="ap-nav-label">{e.label}</span>
                    {e.children.map((i) => navButton(i))}
                  </React.Fragment>
                );
              }
              if (e.tabs) {
                const on = activeParent?.id === e.id;
                return (
                  <button key={e.id} type="button" className={`cx-nav-item ap-nav-btn${on ? " is-active" : ""}`} onClick={() => !on && go(leaves(e)[0].id)}>
                    <e.Icon size={18} aria-hidden="true" /><span>{e.label}</span>
                  </button>
                );
              }
              if (e.children) {
                const open = isOpen(e);
                return (
                  <div key={e.id} className={`ap-nav-menu${open ? " is-open" : ""}`}>
                    <button type="button" className={`cx-nav-item ap-nav-btn${activeParent?.id === e.id && !open ? " is-active" : ""}`}
                      onClick={() => toggle(e)} aria-expanded={open}>
                      <e.Icon size={18} aria-hidden="true" /><span>{e.label}</span>
                      <ChevronDown size={16} className="ap-nav-chevron" aria-hidden="true" />
                    </button>
                    {open && <div className="ap-nav-sub">{e.children.map((i) => navButton(i, " ap-nav-subitem"))}</div>}
                  </div>
                );
              }
              return navButton(e);
            })}
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
              {section === "customer" ? "Customer" : activeParent?.tabs ? activeParent.label : page?.title || page?.label || "Admin"}
            </h1>
            <div className="cx-topbar-actions">
              {me && <NotificationsBell openCustomer={openCustomer} openSection={go} />}
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
            {me && activeParent?.tabs && productTabs()}
            {me ? render() : !error && <div className="cx-card cx-empty"><p>Loading…</p></div>}
          </main>
        </div>
      </div>
    </AdminProtectedRoute>
  );
};

export default AdminDashboard;
