import React, { useState } from "react";
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from "./PrivateRoutes";
import Sidebar from "./Sidebar";
import Home from "./DashboardContent/Home";
import Profile from "./DashboardContent/Profile";
import SubmitTicket from "./DashboardContent/SubmitTicket";
import Wallet from "./DashboardContent/Wallet";
import Deploy from "./DashboardContent/Deploy";
import Logs from "./DashboardContent/Logs";
import ComingSoon from "./DashboardContent/ComingSoon";
import HostingConsole from "./DashboardContent/HostingConsole";
import "./Dashboard.css";

const tabs = [
  { key: "home", label: "Dashboard" },
  { key: 'deploy', label: 'Deploy' },
  { key: 'domains', label: 'Domains' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'wallet', label: "Wallet" },
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "submitTicket", label: "Support" },
  { key: 'logs', label: "Logs"},
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <Sidebar
          tabs={tabs}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="dashboard-content">
          <div className="dashboard-main-contents">
            <Routes>
              <Route path="/home" element={<Home/>} />
              <Route path="/deploy" element={<Deploy/>} />
              <Route path="/domains" element={
                <ComingSoon 
                  title="Domains Management" 
                  description="Domain registration, DNS management, and WHOIS privacy tools are coming soon to Walras Cloud Console."
                />
              } />
              <Route path="/hosting" element={<HostingConsole />} />
              <Route path="/wallet" element={<Wallet/>} />
              <Route path="/profile" element={<Profile/>} />
              <Route path="/notifications" element={
                <ComingSoon 
                  title="Notifications & Alerts" 
                  description="Custom webhook notifications, SMS alerts, and email preferences are coming soon."
                />
              } />
              <Route path="/submitTicket" element={<SubmitTicket/>} />
              <Route path="/logs" element={<Logs/>} />
              <Route path="/" element={<Home/>} />
            </Routes>
          </div>
        </div>

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
      </div>
    </ProtectedRoute>
  );
};

export default DashboardLayout;
