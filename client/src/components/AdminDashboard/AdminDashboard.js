import React, { useEffect, useState } from "react";
import "./AdminDashboard.css";
const Logo = 'https://images.vestige.co.in/buttrcloud/logo.png';
import AdminProtectedRoute from "./AdminPrivateRoute";
import {
  Home,
  Globe,
  Server,
  DollarSign,
  Ticket,
  FileText,
  LogOut,
  CheckCircle,
  AlertTriangle,
  User
} from "lucide-react";

// Import components
import Dashboard from './components/Dashboard';
import Users from './components/Users';
import Transactions from './components/Transactions';
import Invoices from './components/Invoices';
import Servers from './components/Servers';
import PromoCodes from './components/PromoCodes';
import Domain from './components/Domain';
import CreatePromoForm from './components/CreatePromoForm';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboardStats, setDashboardStats] = useState({});
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [servers, setServers] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const API_URL = 'https://buttr.cloud';
  const token = localStorage.getItem("adminToken");

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/dashboardStats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setDashboardStats(data);
      }
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  };

  // Fetch all users with details
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/getAllUsersWithDetails`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error loading users", type: "error" });
    }
  };

  // Fetch all transactions
  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/getAllTransactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error loading transactions", type: "error" });
    }
  };

  // Fetch all servers
  const fetchServers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/getAllServers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setServers(data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error loading servers", type: "error" });
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/getRecentActivity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setRecentActivity(data);
      }
    } catch (err) {
      console.error("Error loading recent activity:", err);
    }
  };

  // Fetch user details
  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/getUser/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUserDetails(data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error fetching user details", type: "error" });
    }
  };

  // Fetch promo codes
  const fetchPromoCodes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/promo-codes?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setPromoCodes(data.promoCodes || data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error loading promo codes", type: "error" });
    }
  };

  // Delete promo code
  const deletePromoCode = async (promoId) => {
    if (!window.confirm("Are you sure you want to delete this promo code?")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/promo-codes/${promoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage({ text: "Promo code deleted successfully", type: "success" });
        fetchPromoCodes();
      } else {
        throw new Error("Failed to delete promo code");
      }
    } catch (err) {
      setMessage({ text: err.message || "Error deleting promo code", type: "error" });
    }
  };

  // Fetch monthly invoices
  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/monthly-invoices?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();
      if (response.ok) {
        setInvoices(data.invoices || data);
      }
    } catch (err) {
      setMessage({ text: err.message || "Error loading invoices", type: "error" });
    }
  };

  // Load data based on active tab
  const loadTabData = async (tab) => {
    setLoading(true);
    try {
      switch (tab) {
        case "dashboard":
          await fetchDashboardStats();
          await fetchRecentActivity();
          break;
        case "users":
          await fetchUsers();
          break;
        case "transactions":
          await fetchTransactions();
          break;
        case "invoices":
          await fetchInvoices();
          break;
        case "servers":
          await fetchServers();
          break;
        case "promo-codes":
          await fetchPromoCodes();
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("Error loading tab data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
  try {
    console.log('Starting delete process for user:', userId);

    // Send ID as URL parameter instead of in body
    const response = await fetch(`${API_URL}/api/admin/deleteUser/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      // Remove the body since we're using URL parameters
    });

    console.log('DELETE Response status:', response.status);
    console.log('DELETE Response URL:', response.url);

    const responseText = await response.text();
    console.log('DELETE Response text length:', responseText.length);
    console.log('DELETE Response text (first 200 chars):', responseText.substring(0, 200));

    // Check if we're getting the React app HTML
    if (responseText.includes('<!doctype') || responseText.includes('create-react-app')) {
      console.error('Got React HTML instead of API response!');
      throw new Error('Backend server not running or route not found');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(result.error || result.message || `Server error: ${response.status}`);
    }

    setMessage({ text: result.message || 'User deleted successfully', type: 'success' });
    setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));

  } catch (error) {
    console.error('Error in handleDeleteUser:', error);
    setMessage({
      text: `Delete failed: ${error.message}`,
      type: 'error'
    });
  }
};

  const handleVerifyUser = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/verifyUser`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify user');
      }

      const result = await response.json();
      setMessage({ text: result.message, type: 'success' });

      // Update user verification status in local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, isVerified: true } : user
        )
      );
    } catch (error) {
      console.error('Error verifying user:', error);
      setMessage({ text: error.message || 'Failed to verify user', type: 'error' });
    }
  };
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    if (adminToken) {
      setAdminInfo({ username: "Admin", access: "owner" });
      loadTabData(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowCreatePromo(false);
    loadTabData(tab);
  };

  // Handle user selection
  const handleUserSelect = (user) => {
    setSelectedUser(user);
    fetchUserDetails(user.id);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${(amount / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return <Dashboard
          dashboardStats={dashboardStats}
          recentActivity={recentActivity}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />;
      case "users":
        return <Users
          users={users}
          handleUserSelect={handleUserSelect}
          formatCurrency={formatCurrency}
          onDeleteUser={handleDeleteUser}  // Add this
          onVerifyUser={handleVerifyUser}  // Add this
        />;
      case "transactions":
        return <Transactions
          transactions={transactions}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />;
      case "invoices":
        return <Invoices
          invoices={invoices}
          loading={loading}
          adminInfo={adminInfo}
          token={token}
          setMessage={setMessage}
          fetchInvoices={fetchInvoices}
          formatDate={formatDate}
        />;
      case "servers":
        return <Servers
          servers={servers}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />;
      case "promo-codes":
        return <PromoCodes
          promoCodes={promoCodes}
          setShowCreatePromo={setShowCreatePromo}
          deletePromoCode={deletePromoCode}
          formatDate={formatDate}
          onPromoUpdate={(updatedPromo) => {
            setPromoCodes(prev => prev.map(promo =>
              promo.id === updatedPromo.id ? updatedPromo : promo
            ));
          }}
        />;
      case "domain":
        return <Domain />;
      default:
        return <Dashboard
          dashboardStats={dashboardStats}
          recentActivity={recentActivity}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />;
    }
  };

  return (
    <AdminProtectedRoute>
      <div className="admin-dashboard">
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <a href="/" className="sidebar-logo-link">
              <img src={Logo} alt="Buttr Cloud" className="sidebar-logo" />
            </a>
            <span className="sidebar-kicker">Admin Panel</span>
          </div>
          <nav className="sidebar-nav">
            {/* Dashboard - Owner only */}
            {adminInfo?.access === 'owner' && (
              <button
                className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => handleTabChange("dashboard")}
              >
                <Home className="nav-icon" size={18} />
                Dashboard
              </button>
            )}

            {/* Servers */}
            {adminInfo?.access === 'owner' && (
              <button
                className={`nav-item ${activeTab === "servers" ? "active" : ""}`}
                onClick={() => handleTabChange("servers")}
              >
                <Server className="nav-icon" size={18} />
                Servers
              </button>
            )}

            {/* Domain */}
            {adminInfo?.access === 'owner' && (
              <button
                className={`nav-item ${activeTab === "domain" ? "active" : ""}`}
                onClick={() => handleTabChange("domain")}
              >
                <Globe className="nav-icon" size={18} />
                Domain
              </button>
            )}

            {/* Transactions */}
            <button
              className={`nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => handleTabChange("transactions")}
            >
              <DollarSign className="nav-icon" size={18} />
              Transactions
            </button>

            {/* Users */}
            {adminInfo?.access === 'owner' && (
              <button
                className={`nav-item ${activeTab === "users" ? "active" : ""}`}
                onClick={() => handleTabChange("users")}
              >
                <User className="nav-icon" size={18} />
                Users
              </button>
            )}

            {/* Promo Codes */}
            {adminInfo?.access === 'owner' && (
              <button
                className={`nav-item ${activeTab === "promo-codes" ? "active" : ""}`}
                onClick={() => handleTabChange("promo-codes")}
              >
                <Ticket className="nav-icon" size={18} />
                Promo Codes
              </button>
            )}

            {/* Invoices */}
            <button
              className={`nav-item ${activeTab === "invoices" ? "active" : ""}`}
              onClick={() => handleTabChange("invoices")}
            >
              <FileText className="nav-icon" size={18} />
              Invoices
            </button>
          </nav>

          {/* Logout */}
          <div className="sidebar-footer">
            <button
              className="nav-item logout-btn"
              onClick={() => window.location.href = '/super-admin-2025'}
            >
              <LogOut className="nav-icon" size={18} />
              Logout
            </button>
          </div>
        </div>

        <div className="admin-main">
          <header className="admin-header">
            <div className="header-left">
              <h1>Admin Dashboard</h1>
              {adminInfo && (
                <div className="admin-info">
                  <span className="admin-username">{adminInfo.username}</span>
                  <span className={`admin-access ${adminInfo.access}`}>
                    {adminInfo.access.charAt(0).toUpperCase() + adminInfo.access.slice(1)}
                  </span>
                </div>
              )}
            </div>
            <div className="header-actions">
              <button
                className="btn btn-secondary"
                onClick={() => window.location.href = '/super-admin-2025'}
              >
                Logout
              </button>
            </div>
          </header>

          {message.text && (
            <div className={`admin-message ${message.type}`}>
              <span className="message-icon">
                {message.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              </span>
              {message.text}
            </div>
          )}

          <main className="admin-content">
            {renderContent()}
          </main>
        </div>
      </div>

      {showCreatePromo && (
        <CreatePromoForm
          onSuccess={() => {
            setShowCreatePromo(false);
            fetchPromoCodes();
          }}
          onCancel={() => setShowCreatePromo(false)}
        />
      )}
    </AdminProtectedRoute>
  );
};

export default AdminDashboard;
