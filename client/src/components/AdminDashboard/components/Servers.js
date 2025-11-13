import React from 'react';

const Servers = ({ servers, formatCurrency, formatDate }) => {
  // Ensure servers is always an array
  const safeServers = Array.isArray(servers) ? servers : [];
  return (
    <div className="servers-management">
      <div className="section-header">
        <h3>Server Management</h3>
        <div className="servers-stats">
          <span>Total: {safeServers.length}</span>
        </div>
      </div>
      
      <div className="servers-table">
        <div className="table-header">
          <div className="table-cell">Server Name</div>
          <div className="table-cell">User</div>
          <div className="table-cell">Status</div>
          <div className="table-cell">Created</div>
          <div className="table-cell">Last Active</div>
          <div className="table-cell">Actions</div>
        </div>
        <div className="table-body">
          {safeServers.map((server) => (
            <div key={server.id} className="table-row">
              <div className="table-cell">
                <strong>{server.name}</strong>
              </div>
              <div className="table-cell">
                <span>{server.user_name}</span>
              </div>
              <div className="table-cell">
                <span className={`status ${server.status}`}>
                  {server.status}
                </span>
              </div>
              <div className="table-cell">
                <span>{formatDate(server.created_at)}</span>
              </div>
              <div className="table-cell">
                <span>{server.last_active ? formatDate(server.last_active) : 'Never'}</span>
              </div>
              <div className="table-cell">
                <div className="action-buttons">
                  <button className="btn btn-primary btn-sm">
                    View Details
                  </button>
                  <button className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Servers;
