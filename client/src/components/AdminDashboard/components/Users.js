import React from 'react';
import { CheckCircle, AlertTriangle, Eye } from 'lucide-react';

const Users = ({ users, handleUserSelect, formatCurrency }) => {
  // Ensure users is always an array
  const safeUsers = Array.isArray(users) ? users : [];
  return (
    <div className="users-management">
      <div className="section-header">
        <h3>User Management</h3>
        <div className="users-stats">
          <span>Total: {safeUsers.length}</span>
        </div>
      </div>
      
      <div className="users-list-header">
        <div className="list-header-info">
          <h4>User Management</h4>
          <p>Manage and view all registered users</p>
        </div>
        <div className="list-header-stats">
          <div className="stat-item">
            <span className="stat-label">Total Users</span>
            <span className="stat-value">{safeUsers.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Verified</span>
            <span className="stat-value">{safeUsers.filter(u => u.isVerified).length}</span>
          </div>
        </div>
      </div>
      
      <div className="users-table">
        <div className="table-body">
          {safeUsers.map((user) => (
            <div key={user.id} className="table-row">
              <div className="table-cell">
                <div className="user-info">
                  <div className="user-avatar">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <strong>{user.name || "Unknown User"}</strong>
                  </div>
                </div>
              </div>
              <div className="table-cell">
                <span>{user.email}</span>
              </div>
              <div className="table-cell">
                <span>{user.company || "No company"}</span>
              </div>
              <div className="table-cell">
                <span>{user.role || "No role"}</span>
              </div>
              <div className="table-cell">
                <span>{user.server_count || 0}</span>
              </div>
              <div className="table-cell">
                <span>{formatCurrency(user.total_spent || 0)}</span>
              </div>
              <div className="table-cell">
                <span className={`status ${user.isVerified ? 'verified' : 'unverified'}`}>
                  {user.isVerified ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                </span>
              </div>
              <div className="table-cell">
                <button 
                  className="btn btn-primary"
                  onClick={() => handleUserSelect(user)}
                >
                  <Eye size={16} />
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Users;
