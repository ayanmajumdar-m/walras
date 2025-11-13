import React from "react";
import { NavLink } from 'react-router-dom';
import { Home, User, Shield, LogOut, Bell, Ticket, Wallet, Earth, Logs, Globe } from "lucide-react";

const Sidebar = ({ tabs, sidebarOpen, setSidebarOpen }) => {
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.href = "/login";
  };

  const icons = {
    home: <Home size={18} />,
    profile: <User size={18} />,
    privacy: <Shield size={18} />,
    notifications: <Bell size={18} />,
    submitTicket: <Ticket size={18} />,
    wallet: <Wallet size={18}/>,
    deploy: <Earth size={18}/>,
    logs: <Logs size={18}/>,
    domain: <Globe size={18}/>
  };

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-header">Dashboard</div>
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={`/dashboard/${tab.key === 'home' ? 'home' : tab.key}`}
          className={({ isActive }) => `sidebar-btn ${isActive ? 'active' : ''}`}
          onClick={() => setSidebarOpen(false)}
        >
          {icons[tab.key]} <span>{tab.label}</span>
        </NavLink>
      ))}
      <button onClick={handleLogout} className="logout-btn">
        <LogOut size={18} /> <span>Logout</span>
      </button>
    </aside>
  );
};

export default Sidebar;
