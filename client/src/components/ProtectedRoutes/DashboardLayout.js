import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Menu, Plus, Wallet as WalletIcon, Wrench } from "lucide-react";
import ProtectedRoute from "./PrivateRoutes";
import Sidebar from "./Sidebar";
import Overview from "./DashboardContent/Overview";
import Create from "./DashboardContent/Create";
import Resources from "./DashboardContent/Resources";
import Billing from "./DashboardContent/Billing";
import Profile from "./DashboardContent/Profile";
import SubmitTicket from "./DashboardContent/SubmitTicket";
import { api, rupees } from "./consoleApi";
import { ConsoleContext } from "./ConsoleContext";
// The retired Home and HostingConsole pages' stylesheets carry generic global
// classes (.message, .primary, .featured, …) that other pages still lean on,
// so they stay loaded here, ahead of the console's own styles.
import "./DashboardContent/Home.css";
import "./DashboardContent/HostingConsole.css";
import "./Console.css";

const TITLES = {
  home: "Overview",
  create: "Create",
  resources: "Resources",
  billing: "Billing",
  wallet: "Billing",
  logs: "Billing",
  submitTicket: "Support",
  profile: "Account",
};

const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [balance, setBalance] = useState(0);
  const [platform, setPlatform] = useState(null);

  const refreshBalance = useCallback(() => {
    api("/api/wallet").then((d) => setBalance(rupees(d.balance))).catch(() => {});
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (userId) api(`/api/users/profile/${userId}`).then(setProfile).catch(() => {});
    refreshBalance();
    fetch("/api/settings/public").then((r) => r.json()).then(setPlatform).catch(() => {});
  }, [refreshBalance]);

  // Close the mobile drawer whenever the page changes.
  useEffect(() => setSidebarOpen(false), [location.pathname]);

  const section = location.pathname.split("/")[2] || "home";
  const title = TITLES[section] || "Console";

  return (
    <ProtectedRoute>
      <ConsoleContext.Provider value={{ profile, balance, refreshBalance, platform }}>
        <div className="cx-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} profile={profile} />

          <div className="cx-main">
            <header className="cx-topbar">
              <button type="button" className="cx-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <h1 className="cx-topbar-title">{title}</h1>
              <div className="cx-topbar-actions">
                <Link to="/dashboard/billing" className="cx-balance" title="Account balance">
                  <WalletIcon size={16} />
                  <span>₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </Link>
                <Link to="/dashboard/create" className="cx-btn cx-btn-primary">
                  <Plus size={16} /> <span className="cx-hide-sm">Create</span>
                </Link>
              </div>
            </header>

            <main className="cx-content">
              {platform?.maintenanceMode ? (
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
                <Route path="/create" element={<Create />} />
                <Route path="/resources" element={<Resources />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/submitTicket" element={<SubmitTicket />} />

                {/* Old per-service pages fold into Create / Resources / Billing. */}
                <Route path="/deploy" element={<Navigate to="/dashboard/create?type=compute" replace />} />
                <Route path="/hosting" element={<Navigate to="/dashboard/resources?tab=hosting" replace />} />
                <Route path="/domains" element={<Navigate to="/dashboard/resources?tab=domains" replace />} />
                <Route path="/notifications" element={<Navigate to="/dashboard/home" replace />} />
                {/* Payment gateways return to /dashboard/wallet?payment_status=… — keep the query. */}
                <Route path="/wallet" element={<Billing initialTab="wallet" />} />
                <Route path="/logs" element={<Billing initialTab="usage" />} />
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
