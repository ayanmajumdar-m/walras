import React, { useState, useEffect } from "react";
import "./Home.css";
import { Bell, Cpu, HardDrive, Database, Play, Square, RotateCcw, Trash2, Globe, Calendar, Clock, Key, Server, ExternalLink, MoreVertical } from "lucide-react";
import EditNSModal from './EditNSModal';
import TransferDomainModal from './TransferDomainModal';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState("servers");
  const [showMessage, setShowMessage] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchServers();
    fetchDomains();
  }, []);
  const API_URL = `https://buttr.cloud`

  const fetchServers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/servers`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      // Handle auth errors (expired/invalid token)
      if (response.status === 401 || (data && /token|expired|invalid/i.test(data.error || ''))) {
        // Clear session and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.setItem('sessionExpiredMessage', data.error || 'Session expired. Please login again.');
        setMessage({ text: data.error || 'Session expired. Redirecting to login...', type: 'error' });
        setTimeout(() => navigate('/login'), 1400);
        return;
      }

      if (response.ok) {
        setServers(data.servers || []);
      } else {
        setMessage({ text: data.error || "Failed to fetch servers", type: "error" });
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
      setMessage({ text: "Failed to fetch servers", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users/domains/purchased`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      // Handle auth errors (expired/invalid token)
      if (response.status === 401 || (data && /token|expired|invalid/i.test(data.error || ''))) {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.setItem('sessionExpiredMessage', data.error || 'Session expired. Please login again.');
        setMessage({ text: data.error || 'Session expired. Redirecting to login...', type: 'error' });
        setTimeout(() => navigate('/login'), 1400);
        return;
      }

      if (response.ok) {
        setDomains(data.domains || []);
      } else {
        setMessage({ text: data.error || "Failed to fetch domains", type: "error" });
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
      setMessage({ text: "Failed to fetch domains", type: "error" });
    } finally {
      setDomainsLoading(false);
    }
  };

  const manageServer = async (serverId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/servers/manage`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ serverId, action })
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage({ text: `Server ${action} successful`, type: "success" });
        fetchServers();
      } else {
        setMessage({ text: result.error || `Failed to ${action} server`, type: "error" });
      }
    } catch (error) {
      console.error(`Error ${action}ing server:`, error);
      setMessage({ text: `Failed to ${action} server`, type: "error" });
    }
  };

  const deleteServer = async (serverId) => {
    if (!window.confirm("Are you sure you want to delete this server?")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/servers/${serverId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setMessage({ text: "Server deleted successfully", type: "success" });
        fetchServers();
      } else {
        setMessage({ text: result.error || "Failed to delete server", type: "error" });
      }
    } catch (error) {
      console.error("Error deleting server:", error);
      setMessage({ text: "Failed to delete server", type: "error" });
    }
  };

  // Modal state for editing nameservers
  const [nsModalOpen, setNsModalOpen] = useState(false);
  const [nsModalDomain, setNsModalDomain] = useState(null);

  const openEditNS = (domain) => {
    setNsModalDomain(domain);
    setNsModalOpen(true);
  };

  const closeEditNS = () => {
    setNsModalDomain(null);
    setNsModalOpen(false);
  };

  const handleSaveNameservers = async (nameservers) => {
    if (!nsModalDomain) throw new Error('No domain selected');
    const payload = {
      openprovider_domain_id: nsModalDomain.openprovider_domain_id || nsModalDomain.openprovider_id || null,
      full_domain: nsModalDomain.full_domain || `${nsModalDomain.domain_name || ''}${nsModalDomain.domain_extension ? '.' + nsModalDomain.domain_extension : ''}`,
      nameservers
    };

    const response = await fetch(`${API_URL}/api/users/openprovider/update-nameservers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update nameservers');
    }

    setMessage({ text: data.message || 'Nameservers updated successfully', type: 'success' });
    closeEditNS();
    fetchDomains();
  };

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferModalDomain, setTransferModalDomain] = useState(null);

  const openTransferModal = (domain) => {
    setTransferModalDomain(domain);
    setTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setTransferModalDomain(null);
    setTransferModalOpen(false);
  };

  const handleTransfer = async ({ auth_code, nameservers, handles }) => {
    if (!transferModalDomain) throw new Error('No domain selected');
    const domainName = transferModalDomain.full_domain || `${transferModalDomain.domain_name || ''}${transferModalDomain.domain_extension ? '.' + transferModalDomain.domain_extension : ''}`;

    const payload = {
      domainName,
      auth_code,
      nameservers,
      handles
    };

    const response = await fetch(`${API_URL}/api/users/openprovider/transfer-domain`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Transfer initiation failed');
    }

    setMessage({ text: data.message || 'Transfer initiated', type: 'success' });
    closeTransferModal();
    fetchDomains();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'deploying': return '#f59e0b';
      case 'stopped': return '#ef4444';
      case 'failed': return '#dc2626';
      case 'registered': return '#10b981';
      case 'expired': return '#dc2626';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'deploying': return 'warning';
      case 'stopped': return 'error';
      case 'failed': return 'error';
      case 'registered': return 'success';
      case 'expired': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getUptime = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else {
      return `${diffHours}h`;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiry = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const activeServers = servers.filter(server => server.status === 'active').length;
  const totalServers = servers.length;
  const totalDomains = domains.length;
  const expiringDomains = domains.filter(domain => {
    const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  }).length;

  return (
    <div className="home-dashboard">
      {/* Message Display */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Manage your servers and domains</p>
        </div>
        <button className="notification-btn">
          <Bell size={20} />
          <span className="notification-badge">3</span>
        </button>
      </div>

      {/* Stats Section */}
      <div className="stats-grid-compact">
        <div className="stat-card-compact">
          <div className="stat-icon server-icon">
            <Server size={20} />
          </div>
          <div className="stat-content">
            <h3>{activeServers}</h3>
            <p>Active VMs</p>
          </div>
        </div>
        <div className="stat-card-compact">
          <div className="stat-icon database-icon">
            <Database size={20} />
          </div>
          <div className="stat-content">
            <h3>{totalServers}</h3>
            <p>Total Servers</p>
          </div>
        </div>
        <div className="stat-card-compact">
          <div className="stat-icon globe-icon">
            <Globe size={20} />
          </div>
          <div className="stat-content">
            <h3>{totalDomains}</h3>
            <p>My Domains</p>
          </div>
        </div>
        <div className="stat-card-compact">
          <div className="stat-icon warning-icon">
            <Clock size={20} />
          </div>
          <div className="stat-content">
            <h3>{expiringDomains}</h3>
            <p>Expiring Soon</p>
          </div>
        </div>
      </div>

      {/* Quick Deploy Card */}
      <div className="deploy-card">
        <div className="deploy-content">
          <h2>Ready to deploy?</h2>
          <p>Launch a new server in seconds</p>
          <button onClick={() => navigate('/dashboard/deploy')} className="deploy-now-btn">
            Deploy Server
            <ExternalLink size={16} />
          </button>
        </div>
        <div className="deploy-graphic">
          <div className="cloud-animation">⚡</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation-compact">
        <button 
          className={`tab-btn ${activeTab === "servers" ? "active" : ""}`}
          onClick={() => setActiveTab("servers")}
        >
          <Server size={16} />
          Servers ({totalServers})
        </button>
        <button 
          className={`tab-btn ${activeTab === "domains" ? "active" : ""}`}
          onClick={() => setActiveTab("domains")}
        >
          <Globe size={16} />
          Domains ({totalDomains})
        </button>
      </div>

      {/* Servers Tab */}
      {activeTab === "servers" && (
        <div className="content-section">
          <div className="section-header">
            <h2>My Servers</h2>
            <div className="section-actions">
              <button className="action-btn primary">Deploy New</button>
            </div>
          </div>
          
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading servers...</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="empty-state">
              <Server size={48} />
              <h3>No servers deployed</h3>
              <p>Deploy your first server to get started</p>
              <button onClick={() => navigate('/dashboard/deploy')} className="action-btn primary">Deploy Server</button>
            </div>
          ) : (
            <div className="cards-grid">
              {servers.map((server) => (
                <div key={server.id} className="server-card">
                  <div className="card-header">
                    <div className="server-title">
                      <h3>{server.name}</h3>
                      <span className={`status-badge ${getStatusVariant(server.status)}`}>
                        {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                      </span>
                    </div>
                    <button className="more-options">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  
                  <div className="server-details-grid">
                    <div className="detail-row">
                      <span className="detail-label">IP Address</span>
                      <span className="detail-value">{server.ip_address}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Plan</span>
                      <span className="detail-value">{server.plan_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Location</span>
                      <span className="detail-value">{server.location}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Uptime</span>
                      <span className="detail-value">{getUptime(server.created_at)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Cost</span>
                      <span className="detail-value">₹{server.hourly_cost.toFixed(2)}/hour</span>
                    </div>
                  </div>
                  
                  <div className="card-actions">
                    {server.status === 'active' ? (
                      <>
                        <button 
                          className="action-btn secondary"
                          onClick={() => manageServer(server.id, 'stop')}
                        >
                          <Square size={14} /> Stop
                        </button>
                        <button 
                          className="action-btn secondary"
                          onClick={() => manageServer(server.id, 'restart')}
                        >
                          <RotateCcw size={14} /> Restart
                        </button>
                      </>
                    ) : server.status === 'stopped' ? (
                      <button 
                        className="action-btn primary"
                        onClick={() => manageServer(server.id, 'start')}
                      >
                        <Play size={14} /> Start
                      </button>
                    ) : null}
                    
                    <button 
                      className="action-btn danger"
                      onClick={() => deleteServer(server.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Domains Tab */}
      {activeTab === "domains" && (
        <div className="content-section">
          <div className="section-header">
            <h2>My Domains</h2>
            <div className="section-actions">
              <button onClick={()=>navigate('/domains')} className="action-btn primary">Register Domain</button>
            </div>
          </div>
          
          {domainsLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading domains...</p>
            </div>
          ) : domains.length === 0 ? (
            <div className="empty-state">
              <Globe size={48} />
              <h3>No domains registered</h3>
              <p>Register your first domain to get started</p>
              <button className="action-btn primary">Register Domain</button>
            </div>
          ) : (
            <div className="cards-grid">
              {domains.map((domain) => {
                const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
                const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                const isExpired = daysUntilExpiry <= 0;

                return (
                  <div key={domain.id} className="domain-card">
                    <div className="card-header">
                      <div className="domain-title">
                        <Globe size={20} className="domain-icon" />
                        <h3>{domain.domain_name}</h3>
                        {isExpiringSoon && (
                          <span className="expiry-badge warning">
                            {daysUntilExpiry}d
                          </span>
                        )}
                        {isExpired && (
                          <span className="expiry-badge danger">
                            EXPIRED
                          </span>
                        )}
                      </div>
                      <span className={`status-badge ${getStatusVariant(domain.status)}`}>
                        {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="domain-details-grid">
                      <div className="detail-row">
                        <Calendar size={14} />
                        <span className="detail-label">Registered</span>
                        <span className="detail-value">{formatDate(domain.registration_date)}</span>
                      </div>
                      <div className="detail-row">
                        <Clock size={14} />
                        <span className="detail-label">Expires</span>
                        <span className="detail-value">{formatDate(domain.expiration_date)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Registrar</span>
                        <span className="detail-value">{domain.registrar || 'OpenProvider'}</span>
                      </div>
                      {domain.auth_code && (
                        <div className="detail-row">
                          <Key size={14} />
                          <span className="detail-label">Auth Code</span>
                          <span className="detail-value auth-code">{domain.auth_code}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="card-actions">
                      <button className="action-btn secondary">
                        Manage DNS
                      </button>
                      <button className="action-btn secondary" onClick={() => openEditNS(domain)}>
                        Edit NS
                      </button>
                      <button className="action-btn secondary">
                        Renew
                      </button>
                      <button className="action-btn secondary" onClick={() => openTransferModal(domain)}>
                        Transfer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Nameservers Modal */}
      <EditNSModal
        open={nsModalOpen}
        onClose={closeEditNS}
        onSave={handleSaveNameservers}
        initialNs={nsModalDomain ? (nsModalDomain.name_servers?.map(n => n.name) || nsModalDomain.nameservers || nsModalDomain.ns || []) : []}
      />

      {/* Transfer Modal */}
      <TransferDomainModal
        open={transferModalOpen}
        onClose={closeTransferModal}
        onTransfer={handleTransfer}
        domainName={transferModalDomain ? (transferModalDomain.full_domain || `${transferModalDomain.domain_name}.${transferModalDomain.domain_extension}`) : ''}
      />
    </div>
  );
};

export default Home;