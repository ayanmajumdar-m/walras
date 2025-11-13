import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  Settings,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';

const Domain = () => {
  const [activeTab, setActiveTab] = useState('tlds');
  const [showCreateTLD, setShowCreateTLD] = useState(false);
  const [showCreateDomain, setShowCreateDomain] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock data for TLDs
  const [tlds, setTlds] = useState([
    {
      id: 1,
      extension: '.com',
      name: 'Commercial',
      price: 12.99,
      renewalPrice: 12.99,
      status: 'active',
      description: 'Most popular domain extension',
      category: 'Generic',
      created_at: '2024-01-15',
      domains_count: 1250
    },
    {
      id: 2,
      extension: '.net',
      name: 'Network',
      price: 14.99,
      renewalPrice: 14.99,
      status: 'active',
      description: 'Network infrastructure domains',
      category: 'Generic',
      created_at: '2024-01-15',
      domains_count: 890
    },
    {
      id: 3,
      extension: '.org',
      name: 'Organization',
      price: 13.99,
      renewalPrice: 13.99,
      status: 'active',
      description: 'Non-profit organizations',
      category: 'Generic',
      created_at: '2024-01-15',
      domains_count: 650
    },
    {
      id: 4,
      extension: '.io',
      name: 'Indian Ocean',
      price: 45.99,
      renewalPrice: 45.99,
      status: 'active',
      description: 'Popular for tech startups',
      category: 'Country Code',
      created_at: '2024-01-20',
      domains_count: 320
    },
    {
      id: 5,
      extension: '.co',
      name: 'Colombia',
      price: 25.99,
      renewalPrice: 25.99,
      status: 'inactive',
      description: 'Alternative to .com',
      category: 'Country Code',
      created_at: '2024-01-25',
      domains_count: 180
    }
  ]);

  // Mock data for domains
  const [domains, setDomains] = useState([
    {
      id: 1,
      domain: 'example.com',
      tld: '.com',
      status: 'registered',
      expiry_date: '2025-01-15',
      auto_renew: true,
      price: 12.99,
      user: 'john@example.com'
    },
    {
      id: 2,
      domain: 'test.net',
      tld: '.net',
      status: 'expired',
      expiry_date: '2024-12-01',
      auto_renew: false,
      price: 14.99,
      user: 'jane@example.com'
    }
  ]);

  const [newTLD, setNewTLD] = useState({
    extension: '',
    name: '',
    price: '',
    renewalPrice: '',
    description: '',
    category: 'Generic',
    status: 'active'
  });

  const [newDomain, setNewDomain] = useState({
    domain: '',
    tld: '',
    user: '',
    price: '',
    auto_renew: true
  });

  const formatCurrency = (amount) => `$${parseFloat(amount).toFixed(2)}`;
  const formatDate = (date) => new Date(date).toLocaleDateString();

  const handleCreateTLD = (e) => {
    e.preventDefault();
    const tld = {
      id: Date.now(),
      ...newTLD,
      price: parseFloat(newTLD.price),
      renewalPrice: parseFloat(newTLD.renewalPrice),
      created_at: new Date().toISOString().split('T')[0],
      domains_count: 0
    };
    setTlds([...tlds, tld]);
    setNewTLD({
      extension: '',
      name: '',
      price: '',
      renewalPrice: '',
      description: '',
      category: 'Generic',
      status: 'active'
    });
    setShowCreateTLD(false);
  };

  const handleCreateDomain = (e) => {
    e.preventDefault();
    const domain = {
      id: Date.now(),
      ...newDomain,
      price: parseFloat(newDomain.price),
      status: 'registered',
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    setDomains([...domains, domain]);
    setNewDomain({
      domain: '',
      tld: '',
      user: '',
      price: '',
      auto_renew: true
    });
    setShowCreateDomain(false);
  };

  const deleteTLD = (id) => {
    setTlds(tlds.filter(tld => tld.id !== id));
  };

  const deleteDomain = (id) => {
    setDomains(domains.filter(domain => domain.id !== id));
  };

  const filteredTLDs = tlds.filter(tld => {
    const matchesSearch = tld.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tld.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || tld.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredDomains = domains.filter(domain => {
    const matchesSearch = domain.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      domain.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || domain.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="domain-section">
      <div className="section-header">
        <h2>Domain Management</h2>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowCreateTLD(true)}
          >
            <Plus size={16} />
            Add TLD
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateDomain(true)}
          >
            <Plus size={16} />
            Register Domain
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="domain-tabs">
        <button
          className={`tab ${activeTab === 'tlds' ? 'active' : ''}`}
          onClick={() => setActiveTab('tlds')}
        >
          <Globe size={16} />
          TLD Management
        </button>
        <button
          className={`tab ${activeTab === 'domains' ? 'active' : ''}`}
          onClick={() => setActiveTab('domains')}
        >
          <Search size={16} />
          Domain Registry
        </button>
        <button
          className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <Settings size={16} />
          Analytics
        </button>
      </div>

      {/* Search and Filter */}
      <div className="domain-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search domains or TLDs..."
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="registered">Registered</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* TLD Management Tab */}
      {activeTab === 'tlds' && (
        <div className="tld-management">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Globe size={20} />
              </div>
              <div className="stat-content">
                <h4>{tlds.length}</h4>
                <p>Total TLDs</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <CheckCircle size={20} />
              </div>
              <div className="stat-content">
                <h4>{tlds.filter(tld => tld.status === 'active').length}</h4>
                <p>Active TLDs</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <DollarSign size={20} />
              </div>
              <div className="stat-content">
                <h4>{formatCurrency(tlds.reduce((sum, tld) => sum + tld.price, 0))}</h4>
                <p>Total Revenue</p>
              </div>
            </div>
          </div>

          <div className="tld-table">
            <div className="table-container">
              <table className="table-wrapper">
                <thead>
                  <tr>
                    <th>Extension</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Renewal</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Domains</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTLDs.map((tld) => (
                    <tr key={tld.id}>
                      <td>
                        <div className="tld-extension">
                          <strong>{tld.extension}</strong>
                        </div>
                      </td>
                      <td>
                        <div className="tld-name">
                          <div className="name">{tld.name}</div>
                          <div className="description">{tld.description}</div>
                        </div>
                      </td>
                      <td>
                        <span className="price">{formatCurrency(tld.price)}</span>
                      </td>
                      <td>
                        <span className="price">{formatCurrency(tld.renewalPrice)}</span>
                      </td>
                      <td>
                        <span className="category">{tld.category}</span>
                      </td>
                      <td>
                        <span className={`status ${tld.status}`}>
                          {tld.status === 'active' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          {tld.status.charAt(0).toUpperCase() + tld.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="count">{tld.domains_count}</span>
                      </td>
                      <td>
                        <span className="date">{formatDate(tld.created_at)}</span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit TLD"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteTLD(tld.id)}
                            title="Delete TLD"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Domain Registry Tab */}
      {activeTab === 'domains' && (
        <div className="domain-registry">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Search size={20} />
              </div>
              <div className="stat-content">
                <h4>{domains.length}</h4>
                <p>Total Domains</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <CheckCircle size={20} />
              </div>
              <div className="stat-content">
                <h4>{domains.filter(domain => domain.status === 'registered').length}</h4>
                <p>Active Domains</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="stat-content">
                <h4>{domains.filter(domain => domain.status === 'expired').length}</h4>
                <p>Expired Domains</p>
              </div>
            </div>
          </div>

          <div className="domain-table">
            <div className="table-container">
              <table className="table-wrapper">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>TLD</th>
                    <th>Status</th>
                    <th>User</th>
                    <th>Price</th>
                    <th>Expiry Date</th>
                    <th>Auto Renew</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDomains.map((domain) => (
                    <tr key={domain.id}>
                      <td>
                        <div className="domain-name">
                          <strong>{domain.domain}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="tld">{domain.tld}</span>
                      </td>
                      <td>
                        <span className={`status ${domain.status}`}>
                          {domain.status === 'registered' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className="user">{domain.user}</span>
                      </td>
                      <td>
                        <span className="price">{formatCurrency(domain.price)}</span>
                      </td>
                      <td>
                        <span className="date">{formatDate(domain.expiry_date)}</span>
                      </td>
                      <td>
                        <span className={`auto-renew ${domain.auto_renew ? 'enabled' : 'disabled'}`}>
                          {domain.auto_renew ? <Eye size={16} /> : <EyeOff size={16} />}
                          {domain.auto_renew ? 'Enabled' : 'Disabled'}
                        </span>
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
                            onClick={() => deleteDomain(domain.id)}
                            title="Delete Domain"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="domain-analytics">
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Revenue Overview</h3>
              <div className="chart-placeholder">
                <DollarSign size={48} />
                <p>Revenue chart will be displayed here</p>
              </div>
            </div>
            <div className="analytics-card">
              <h3>TLD Performance</h3>
              <div className="chart-placeholder">
                <Globe size={48} />
                <p>TLD performance chart will be displayed here</p>
              </div>
            </div>
            <div className="analytics-card">
              <h3>Domain Registrations</h3>
              <div className="chart-placeholder">
                <Calendar size={48} />
                <p>Registration trends will be displayed here</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create TLD Modal */}
      {showCreateTLD && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New TLD</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateTLD(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTLD} className="tld-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Extension</label>
                  <input
                    type="text"
                    value={newTLD.extension}
                    onChange={(e) => setNewTLD({ ...newTLD, extension: e.target.value })}
                    placeholder=".example"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newTLD.name}
                    onChange={(e) => setNewTLD({ ...newTLD, name: e.target.value })}
                    placeholder="Example TLD"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTLD.price}
                    onChange={(e) => setNewTLD({ ...newTLD, price: e.target.value })}
                    placeholder="12.99"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Renewal Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTLD.renewalPrice}
                    onChange={(e) => setNewTLD({ ...newTLD, renewalPrice: e.target.value })}
                    placeholder="12.99"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newTLD.category}
                    onChange={(e) => setNewTLD({ ...newTLD, category: e.target.value })}
                  >
                    <option value="Generic">Generic</option>
                    <option value="Country Code">Country Code</option>
                    <option value="Sponsored">Sponsored</option>
                    <option value="Infrastructure">Infrastructure</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newTLD.status}
                    onChange={(e) => setNewTLD({ ...newTLD, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newTLD.description}
                  onChange={(e) => setNewTLD({ ...newTLD, description: e.target.value })}
                  placeholder="Describe this TLD..."
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTLD(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create TLD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Domain Modal */}
      {showCreateDomain && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Domain</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateDomain(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateDomain} className="domain-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Domain Name</label>
                  <input
                    type="text"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    placeholder="example"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>TLD</label>
                  <select
                    value={newDomain.tld}
                    onChange={(e) => setNewDomain({ ...newDomain, tld: e.target.value })}
                    required
                  >
                    <option value="">Select TLD</option>
                    {tlds.filter(tld => tld.status === 'active').map(tld => (
                      <option key={tld.id} value={tld.extension}>
                        {tld.extension} - {tld.name} ({formatCurrency(tld.price)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>User Email</label>
                  <input
                    type="email"
                    value={newDomain.user}
                    onChange={(e) => setNewDomain({ ...newDomain, user: e.target.value })}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDomain.price}
                    onChange={(e) => setNewDomain({ ...newDomain, price: e.target.value })}
                    placeholder="12.99"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newDomain.auto_renew}
                    onChange={(e) => setNewDomain({ ...newDomain, auto_renew: e.target.checked })}
                  />
                  Enable Auto-Renewal
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateDomain(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Domain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Domain;