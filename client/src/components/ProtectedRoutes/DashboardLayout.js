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
import "./Dashboard.css";

const tabs = [
  { key: "home", label: "Dashboard" },
  { key: 'deploy', label: 'Deploy' },
  { key: 'wallet', label: "Wallet" },
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "submitTicket", label: "Support" },
  {key: 'logs', label: "Logs"},
];

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // We'll use route-based tabs. active tab is derived from the current path inside Sidebar via NavLink.

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <Sidebar
          tabs={tabs}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="dashboard-content">
          {/* route-based content for each tab */}
          <div className="dashboard-main-contents">
            <Routes>
              <Route path="/home" element={<Home/>} />
              <Route path="/deploy" element={<Deploy/>} />
              <Route path="/wallet" element={<Wallet/>} />
              <Route path="/profile" element={<Profile/>} />
              <Route path="/notifications" element={<div>Manage your Notifications here</div>} />
              <Route path="/submitTicket" element={<SubmitTicket/>} />
              <Route path="/logs" element={<Logs/>} />
              {/* default to /home */}
              <Route path="/" element={<Home/>} />
            </Routes>
          </div>
        </div>

        {/* Sidebar toggle at bottom */}
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
