import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Eye, X, Mail, Building, User, Server, DollarSign } from 'lucide-react';
import './Users.css';

const Users = ({ users, handleUserSelect, formatCurrency, onDeleteUser, onVerifyUser }) => {
  const safeUsers = Array.isArray(users) ? users : [];
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleViewClick = (user) => {
    setSelectedUser(user);
    setShowModal(true);
    handleUserSelect(user);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const handleDelete = async () => {
    if (!selectedUser || !onDeleteUser) return;
    
    setLoading(true);
    try {
      const response = await fetch('https://superflare.io/api/admin/deleteUser', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: selectedUser.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }

      const result = await response.json();
      console.log(result.message);
      
      // Call the parent callback to update the UI
      onDeleteUser(selectedUser.id);
      handleCloseModal();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedUser || !onVerifyUser) return;
    
    setLoading(true);
    try {
      const response = await fetch('https://superflare.io/api/admin/verifyUser', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify user');
      }

      const result = await response.json();
      console.log(result.message);
      
      // Call the parent callback to update the UI
      onVerifyUser(selectedUser.id);
      handleCloseModal();
    } catch (error) {
      console.error('Error verifying user:', error);
      alert(error.message || 'Failed to verify user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="users">
      <div className="users-header">
        <h2>User Management</h2>
        <div className="users-count">
          <span>Total Users: {safeUsers.length}</span>
        </div>
      </div>

      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th className="col-user">User</th>
              <th className="col-email">Email</th>
              <th className="col-company">Company</th>
              <th className="col-role">Role</th>
              <th className="col-servers">Servers</th>
              <th className="col-spent">Total Spent</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeUsers.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  No users found
                </td>
              </tr>
            ) : (
              safeUsers.map((user) => (
                <tr key={user.id} className="user-row">
                  <td className="col-user">
                    <div className="user-cell">
                      <div className="avatar">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <span className="name">{user.name || "Unknown User"}</span>
                    </div>
                  </td>
                  <td className="col-email">
                    <span className="email">{user.email}</span>
                  </td>
                  <td className="col-company">
                    <span className="company">{user.company || "No company"}</span>
                  </td>
                  <td className="col-role">
                    <span className="role">{user.role || "No role"}</span>
                  </td>
                  <td className="col-servers">
                    <span className="servers">{user.server_count || 0}</span>
                  </td>
                  <td className="col-spent">
                    <span className="spent">{formatCurrency(user.total_spent || 0)}</span>
                  </td>
                  <td className="col-status">
                    <div className={`status ${user.isVerified ? 'verified' : 'unverified'}`}>
                      {user.isVerified ? (
                        <>
                          <CheckCircle size={16} />
                          <span>Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} />
                          <span>Unverified</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="col-actions">
                    <button 
                      className="view-btn"
                      onClick={() => handleViewClick(user)}
                    >
                      <Eye size={16} />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* User Details Modal */}
      {showModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>User Details</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="user-profile">
                <div className="profile-avatar">
                  {selectedUser.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="profile-info">
                  <h2>{selectedUser.name || "Unknown User"}</h2>
                  <div className={`profile-status ${selectedUser.isVerified ? 'verified' : 'unverified'}`}>
                    {selectedUser.isVerified ? 'Verified User' : 'Unverified User'}
                  </div>
                </div>
              </div>

              <div className="user-details-grid">
                <div className="detail-item">
                  <div className="detail-icon">
                    <Mail size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Email</label>
                    <span>{selectedUser.email}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">
                    <Building size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Company</label>
                    <span>{selectedUser.company || "No company"}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">
                    <User size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Role</label>
                    <span>{selectedUser.role || "No role"}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">
                    <Server size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Servers</label>
                    <span>{selectedUser.server_count || 0}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">
                    <DollarSign size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Total Spent</label>
                    <span>{formatCurrency(selectedUser.total_spent || 0)}</span>
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="detail-content">
                    <label>Verification Status</label>
                    <span className={`status-text ${selectedUser.isVerified ? 'verified' : 'unverified'}`}>
                      {selectedUser.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {!selectedUser.isVerified && (
                <button 
                  className="verify-btn" 
                  onClick={handleVerify}
                  disabled={loading}
                >
                  <CheckCircle size={16} />
                  {loading ? 'Verifying...' : 'Verify User'}
                </button>
              )}
              <button 
                className="delete-btn" 
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;