import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Menu, Plus, Wallet as WalletIcon, Wrench, Users, Lock, X, ShieldCheck } from "lucide-react";
import ProtectedRoute from "./PrivateRoutes";
import Sidebar from "./Sidebar";
import Overview from "./DashboardContent/Overview";
import Create from "./DashboardContent/Create";
import Reserve from "./DashboardContent/Reserve";
import Resources from "./DashboardContent/Resources";
import Billing from "./DashboardContent/Billing";
import Profile from "./DashboardContent/Profile";
import Support from "./DashboardContent/Support";
import Dedicated from "./DashboardContent/Dedicated";
import { api, rupees, actingAccount, switchAccount, ACCOUNT_KEY } from "./consoleApi";
import { ConsoleContext } from "./ConsoleContext";
// The retired Home page's stylesheet carries generic global classes
// (.message, .primary, .featured, …) that other pages still lean on, so it
// stays loaded here, ahead of the console's own styles.
import "./DashboardContent/Home.css";
import "./Console.css";

const TITLES = {
  home: "Overview",
  create: "Create",
  reserve: "Reserve & Save",
  resources: "Resources",
  dedicated: "Dedicated Servers",
  billing: "Billing",
  wallet: "Billing",
  logs: "Billing",
  support: "Support",
  submitTicket: "Support",
  profile: "Account",
};

const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [platform, setPlatform] = useState(null);
  // Teams I'm in (for the account switcher) and, when working in one, which.
  const [memberships, setMemberships] = useState(null);
  const [teamNotice, setTeamNotice] = useState(() => {
    try {
      const n = localStorage.getItem("teamNotice");
      localStorage.removeItem("teamNotice");
      return n;
    } catch { return null; }
  });
  const actingId = actingAccount();
  const account = actingId && memberships ? memberships.find((m) => String(m.ownerId) === actingId) || null : null;
  const teamReady = !actingId || memberships !== null;
  // Your own account: everything. In a team account: the areas the owner
  // gave you (servers / billing / support); only Admin may delete or manage
  // the team.
  const can = useCallback((perm) => {
    if (!actingId) return true;
    if (!account) return false;
    if (perm === "delete" || perm === "team") return account.role === "admin";
    return (account.areas || []).includes(perm);
  }, [actingId, account]);

  // KYC status of the account being worked in, and which services wait on it.
  const [kyc, setKyc] = useState(null);
  const refreshKyc = useCallback(() => {
    api("/api/kyc/status").then(setKyc).catch(() => {});
  }, []);

  const refreshBalance = useCallback(() => {
    api("/api/wallet").then((d) => setBalance(rupees(d.balance))).catch(() => {});
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) api(`/api/users/profile/${userId}`).then(setProfile).catch(() => {});
    refreshBalance();
    refreshKyc();
    fetch("/api/settings/public").then((r) => r.json()).then(setPlatform).catch(() => {});
    api("/api/team").then((d) => setMemberships(d.memberships || [])).catch(() => setMemberships([]));
  }, [refreshBalance, refreshKyc]);

  // Stored team account I'm no longer in: back to my own.
  useEffect(() => {
    if (actingId && memberships && !account) {
      try {
        localStorage.removeItem(ACCOUNT_KEY);
        localStorage.setItem("teamNotice", "You no longer have access to that account, so you're back in your own.");
      } catch { /* ignore */ }
      window.location.reload();
    }
  }, [actingId, memberships, account]);

  // Pages need servers / billing / support access when in a team account.
  const need = (perm, element) => (can(perm) ? element : (
    <div className="cx-card cx-empty">
      <span className="cx-empty-icon"><Lock size={26} aria-hidden="true" /></span>
      <h4>You don't have access to this</h4>
      <p>You don't have {perm} access in {account?.ownerName || "this"}'s account. Ask an account admin for it.</p>
      <Link to="/dashboard/home" className="cx-btn cx-btn-ghost">Back to overview</Link>
    </div>
  ));

  // Unpaid invoice banner (monthly renewals). Refreshed on each page change,
  // so it clears right after paying.
  const [billingDue, setBillingDue] = useState(null);
  useEffect(() => {
    if (!teamReady || !can("billing")) return;
    api("/api/invoices").then((d) => setBillingDue(d.summary?.due > 0 ? d.summary : null)).catch(() => {});
  }, [location.pathname, location.search, teamReady, can]);

  // Close the mobile drawer whenever the page changes.
  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const section = location.pathname.split("/")[2] || "home";
  const title = TITLES[section] || "Console";

  return (
    <ProtectedRoute>
      <ConsoleContext.Provider value={{ profile, balance, refreshBalance, platform, account, memberships: memberships || [], can, kyc, refreshKyc }}>
        <div className="cx-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} profile={profile} account={account} memberships={memberships || []} can={can} />

          <div className="cx-main">
            <header className="cx-topbar">
              <button type="button" className="cx-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <h1 className="cx-topbar-title">{title}</h1>
              <div className="cx-topbar-actions">
                {can("billing") && (
                  <Link to="/dashboard/billing" className="cx-balance" title="Account balance">
                    <WalletIcon size={16} />
                    <span>₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </Link>
                )}
                {can("servers") && (
                  <Link to="/dashboard/create" className="cx-btn cx-btn-primary">
                    <Plus size={16} /> <span className="cx-hide-sm">Create</span>
                  </Link>
                )}
              </div>
            </header>

            <main className="cx-content">
              {account && (
                <div className="cx-team-banner" role="status">
                  <Users size={16} aria-hidden="true" />
                  <span>You're working in <strong>{account.ownerName || account.ownerEmail}</strong>'s account.</span>
                  <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => switchAccount(null)}>Back to my account</button>
                </div>
              )}
              {billingDue && !(location.pathname.startsWith("/dashboard/billing") && location.search.includes("tab=invoices")) && (
                <div className={`cx-alert ${billingDue.overdue ? "is-error" : "is-info"} cx-due-banner`} role="status">
                  <span>
                    <strong>₹{billingDue.due.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due on your invoice.</strong>{" "}
                    {billingDue.suspended ? "Your services are suspended until it's paid."
                      : billingDue.overdue ? "It's overdue: pay now to avoid suspension."
                        : billingDue.oldest?.payBy ? `Pay by ${new Date(billingDue.oldest.payBy).toLocaleString("en-IN", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })} to avoid a late fee.` : ""}
                  </span>
                  <Link to="/dashboard/billing?tab=invoices" className="cx-btn cx-btn-primary cx-btn-sm">Pay invoice</Link>
                </div>
              )}
              {!account && kyc && kyc.status !== "verified" && kyc.required.length > 0 && !(location.pathname.startsWith("/dashboard/profile") && location.search.includes("tab=kyc")) && (
                <div className={`cx-alert ${kyc.status === "rejected" ? "is-error" : "is-info"} cx-due-banner`} role="status">
                  <span>
                    {kyc.status === "pending"
                      ? <><strong>We're checking your KYC documents.</strong> {kyc.required.map((r) => r.label).join(", ")} unlock once you're verified.</>
                      : kyc.status === "rejected"
                        ? <><strong>We couldn't verify your KYC documents.</strong> Please send them again.</>
                        : <><strong>Complete your KYC</strong> to order {kyc.required.map((r) => r.label).join(", ")}.</>}
                  </span>
                  {kyc.status !== "pending" && <Link to="/dashboard/profile?tab=kyc" className="cx-btn cx-btn-primary cx-btn-sm"><ShieldCheck size={15} /> Complete KYC</Link>}
                </div>
              )}
              {teamNotice && (
                <div className="cx-alert is-info" role="status">
                  <span>{teamNotice}</span>
                  <button type="button" className="cx-icon-btn" onClick={() => setTeamNotice(null)} aria-label="Dismiss"><X size={15} /></button>
                </div>
              )}
              {!teamReady ? (
                <div className="cx-card cx-empty"><p>Loading account…</p></div>
              ) : platform?.maintenanceMode ? (
                <div className="cx-card cx-empty cx-maintenance">
                  <span className="cx-empty-icon"><Wrench size={26} aria-hidden="true" /></span>
                  <h4>We're doing some maintenance</h4>
                  <p>The console is temporarily unavailable while we work on the platform. Your services keep running. Please check back shortly.</p>
                  <a href="/contact" className="cx-btn cx-btn-ghost">Contact support</a>
                </div>
              ) : (
              <Routes>
                <Route path="/" element={<Navigate to="home" replace />} />
                <Route path="/home" element={<Overview />} />
                <Route path="/create" element={need("servers", <Create />)} />
                <Route path="/reserve" element={need("servers", <Reserve />)} />
                <Route path="/resources" element={need("servers", <Resources />)} />
                <Route path="/dedicated" element={need("servers", <Dedicated />)} />
                <Route path="/billing" element={need("billing", <Billing />)} />
                <Route path="/profile" element={<Profile />} />
                {/* KYC is a tab of Account now; emails sent earlier link here. */}
                <Route path="/kyc" element={<Navigate to="/dashboard/profile?tab=kyc" replace />} />
                <Route path="/support" element={need("support", <Support />)} />

                {/* Old per-service pages fold into Create / Resources / Billing. */}
                <Route path="/deploy" element={<Navigate to="/dashboard/create?type=compute" replace />} />
                <Route path="/domains" element={<Navigate to="/dashboard/resources?tab=domains" replace />} />
                <Route path="/submitTicket" element={<Navigate to="/dashboard/support" replace />} />
                <Route path="/notifications" element={<Navigate to="/dashboard/home" replace />} />
                {/* Payment gateways return to /dashboard/wallet?payment_status=… — keep the query. */}
                <Route path="/wallet" element={need("billing", <Billing initialTab="wallet" />)} />
                <Route path="/logs" element={need("billing", <Billing initialTab="usage" />)} />
                <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
              </Routes>
              )}
            </main>
          </div>
        </div>
      </ConsoleContext.Provider>
    </ProtectedRoute>
  );
};

export default DashboardLayout;
