import React, { useEffect, useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Eye,
  Trash2,
  RefreshCw
} from "lucide-react";

const Domain = () => {
  const [domains, setDomains] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));


  // Fetch domains from backend
  const fetchDomains = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await fetch("/api/admin/getAllDomains", {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);

      if (res.status === 403) {
        throw new Error("Access forbidden. Please check your admin permissions.");
      }

      if (res.status === 401) {
        throw new Error("Unauthorized. Please log in again.");
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch domains: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Fetched domains:', data);
      setDomains(Array.isArray(data) ? data : []);

    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || "Something went wrong while fetching domains");
      setDomains([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleRefresh = () => {
    fetchDomains(true);
  };

  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return "-";
    }
  };

  const formatCurrency = (currency, amount) => {
    if (!amount && amount !== 0) return "-";
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return "-";

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(numericAmount);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'registered':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'failed':
        return <AlertTriangle size={16} className="text-red-500" />;
      case 'processing':
        return <RefreshCw size={16} className="text-blue-500" />;
      case 'expired':
        return <AlertTriangle size={16} className="text-orange-500" />;
      default:
        return <AlertTriangle size={16} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'registered': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'warning';
      case 'expired': return 'expired';
      default: return 'default';
    }
  };

  const filteredDomains = domains.filter((domain) => {
    const matchesSearch =
      domain.full_domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      domain.user_id?.toString().includes(searchTerm) ||
      domain.domain_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || domain.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleDeleteDomain = async (id) => {
    if (!window.confirm("Are you sure you want to delete this domain record?")) {
      return;
    }

    try {
      // If you have a delete endpoint, implement it here
      // await fetch(`http://localhost:3001/api/admin/domains/${id}`, {
      //   method: 'DELETE',
      //   credentials: 'include'
      // });

      // For now, just remove from UI
      setDomains(domains.filter(domain => domain.id !== id));
    } catch (err) {
      setError("Failed to delete domain");
      console.error('Delete error:', err);
    }
  };

  // Statistics
  const stats = {
    total: domains.length,
    registered: domains.filter(d => d.status === 'registered').length,
    failed: domains.filter(d => d.status === 'failed').length,
    processing: domains.filter(d => d.status === 'processing').length,
    expired: domains.filter(d => d.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="domain-section">
        <div className="section-header">
          <h2>Domain Registry</h2>
        </div>
        <div className="loading-container">
          <RefreshCw size={24} className="animate-spin" />
          <p>Loading domains...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="domain-section">
      <div className="section-header">
        <h2>Domain Registry</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <span>{error}</span>
          <button onClick={() => setError("")} className="close-btn">×</button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="domain-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by domain, user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-box">
          <Filter size={16} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="registered">Registered</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <Search size={20} />
          </div>
          <div className="stat-content">
            <h4>{stats.total}</h4>
            <p>Total Domains</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <h4>{stats.registered}</h4>
            <p>Active Domains</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon error">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-content">
            <h4>{stats.failed}</h4>
            <p>Failed Registrations</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <RefreshCw size={20} />
          </div>
          <div className="stat-content">
            <h4>{stats.processing}</h4>
            <p>Processing</p>
          </div>
        </div>
      </div>

      {/* Domain Table */}
      <div className="domain-table">
        <div className="table-container">
          <table className="table-wrapper">
            <thead>
              <tr>
                <th>Domain</th>
                <th>User ID</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Registered</th>
                <th>Expires</th>
                <th>Auth Code</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredDomains.map((domain) => (
                <tr key={domain.id}>
                  <td>
                    <strong>{domain.full_domain}</strong>
                    {domain.domain_name && (
                      <div className="domain-breakdown">
                        {domain.domain_name}.{domain.domain_extension}
                      </div>
                    )}
                  </td>

                  <td className="user-id">{domain.user_id || "-"}</td>

                  <td>
                    <span className={`status status-${getStatusColor(domain.status)}`}>
                      {getStatusIcon(domain.status)}
                      {domain.status || 'unknown'}
                    </span>
                  </td>

                  <td className="amount">
                    {formatCurrency(domain.currency, domain.amount)}
                  </td>

                  <td>{formatDate(domain.registration_date)}</td>
                  <td>{formatDate(domain.expiration_date)}</td>

                  <td className="auth-code">
                    {domain.auth_code ? (
                      <code>{domain.auth_code}</code>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-secondary btn-sm"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteDomain(domain.id)}
                        title="Delete Domain"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDomains.length === 0 && (
                <tr>
                  <td colSpan="8" className="no-data">
                    {domains.length === 0 ? "No domains found" : "No domains match your search criteria"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add some basic CSS for new elements */}
      <style jsx>{`
        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #666;
        }
        
        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .close-btn {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #c33;
        }
        
        .domain-breakdown {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        
        .status-success { background: #f0f9f0; color: #0a0; }
        .status-error { background: #fef0f0; color: #c33; }
        .status-warning { background: #fffbf0; color: #e6a700; }
        .status-expired { background: #fff4f4; color: #f56565; }
        .status-default { background: #f8f9fa; color: #666; }
        
        .no-data {
          text-align: center;
          color: #666;
          padding: 40px !important;
        }
      `}</style>
    </div>
  );
};

export default Domain;