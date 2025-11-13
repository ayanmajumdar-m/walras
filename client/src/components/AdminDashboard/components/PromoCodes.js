import React, { useState } from 'react';
import { Edit, Trash2, Plus, CheckCircle, AlertTriangle, Save, X, Loader2 } from 'lucide-react';

const PromoCodes = ({ 
  promoCodes = [], 
  setShowCreatePromo, 
  deletePromoCode, 
  formatDate,
  onPromoUpdate 
}) => {
  const [editingPromo, setEditingPromo] = useState(null);
  const [editForm, setEditForm] = useState({
    code: '',
    description: '',
    credit_amount: '',
    usage_limit: '',
    is_active: true,
    expires_at: ''
  });
  const API_URL='https://superflare.io' || 'http://localhost:3001';
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  const safePromoCodes = Array.isArray(promoCodes) ? promoCodes : [];
  const token = localStorage.getItem("adminToken");

  const handleEditPromo = (promo) => {
    setEditingPromo(promo.id);
    setEditError('');
    setEditForm({
      code: promo.code,
      description: promo.description || '',
      credit_amount: promo.credit_amount.toString(),
      usage_limit: promo.usage_limit ? promo.usage_limit.toString() : '',
      is_active: promo.is_active,
      expires_at: promo.expires_at ? promo.expires_at.split('T')[0] : ''
    });
  };

  const validateEditForm = () => {
    if (!editForm.code.trim()) {
      setEditError('Promo code is required');
      return false;
    }
    if (!editForm.credit_amount || isNaN(editForm.credit_amount) || parseFloat(editForm.credit_amount) <= 0) {
      setEditError('Credit amount must be a positive number');
      return false;
    }
    if (editForm.usage_limit && (isNaN(editForm.usage_limit) || parseInt(editForm.usage_limit) <= 0)) {
      setEditError('Usage limit must be a positive number');
      return false;
    }
    if (editForm.expires_at && new Date(editForm.expires_at) <= new Date()) {
      setEditError('Expiry date must be in the future');
      return false;
    }
    return true;
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    
    if (!validateEditForm()) {
      return;
    }

    setEditLoading(true);
    
    try {
      const updateData = {
        code: editForm.code.trim(),
        description: editForm.description.trim(),
        credit_amount: parseFloat(editForm.credit_amount),
        usage_limit: editForm.usage_limit ? parseInt(editForm.usage_limit) : null,
        is_active: editForm.is_active,
        expires_at: editForm.expires_at || null
      };

      const response = await fetch(`${API_URL}/api/admin/promo-codes/${editingPromo}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (response.ok) {
        // Success - close edit mode and update local state
        setEditingPromo(null);
        setEditLoading(false);
        
        // Update the promo code in the parent component's state
        if (onPromoUpdate) {
          const updatedPromo = {
            ...safePromoCodes.find(promo => promo.id === editingPromo),
            code: updateData.code,
            description: updateData.description,
            credit_amount: updateData.credit_amount,
            usage_limit: updateData.usage_limit,
            is_active: updateData.is_active,
            expires_at: updateData.expires_at
          };
          onPromoUpdate(updatedPromo);
        }
        
        // Show success indicator
        setEditSuccess(true);
        setTimeout(() => setEditSuccess(false), 2000);
      } else {
        setEditError(result.message || 'Failed to update promo code');
        setEditLoading(false);
      }
    } catch (error) {
      console.error('Error updating promo code:', error);
      setEditError('Network error. Please try again.');
      setEditLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingPromo(null);
    setEditError('');
    setEditForm({
      code: '',
      description: '',
      credit_amount: '',
      usage_limit: '',
      is_active: true,
      expires_at: ''
    });
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (editError) {
      setEditError('');
    }
  };

  return (
    <div className="promo-codes-section">
      <div className="section-header">
        <h2>Promo Codes</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreatePromo(true)}
        >
          <Plus size={16} />
          Create Promo Code
        </button>
      </div>

      <div className="promo-codes-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Edit size={20} />
          </div>
          <div className="stat-content">
            <h4>{safePromoCodes.length}</h4>
            <p>Total Codes</p>
          </div>
        </div>
      </div>
      
      <div className="promo-codes-table">
        <div className="table-container">
          <table className="table-wrapper">
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Credit Amount</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {safePromoCodes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <div className="empty-icon">
                      <Edit size={48} />
                    </div>
                    <h3>No Promo Codes</h3>
                    <p>Create your first promo code to get started</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowCreatePromo(true)}
                    >
                      <Plus size={16} />
                      Create Promo Code
                    </button>
                  </td>
                </tr>
              ) : (
                safePromoCodes.map((promo) => (
                  <tr key={promo.id}>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <input
                            type="text"
                            value={editForm.code}
                            onChange={(e) => handleInputChange('code', e.target.value)}
                            className="form-input"
                            placeholder="Enter promo code"
                            disabled={editLoading}
                          />
                        </div>
                      ) : (
                        <div className="promo-code">
                          <strong>{promo.code}</strong>
                        </div>
                      )}
                    </td>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            className="form-input"
                            placeholder="Enter description"
                            disabled={editLoading}
                          />
                        </div>
                      ) : (
                        <span className="description">{promo.description || 'No description'}</span>
                      )}
                    </td>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <input
                            type="number"
                            value={editForm.credit_amount}
                            onChange={(e) => handleInputChange('credit_amount', e.target.value)}
                            className="form-input"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            disabled={editLoading}
                          />
                        </div>
                      ) : (
                        <span className="amount">₹{promo.credit_amount}</span>
                      )}
                    </td>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <input
                            type="number"
                            value={editForm.usage_limit}
                            onChange={(e) => handleInputChange('usage_limit', e.target.value)}
                            className="form-input"
                            placeholder="∞"
                            min="1"
                            disabled={editLoading}
                          />
                        </div>
                      ) : (
                        <span className="usage">
                          {promo.usage_count}/{promo.usage_limit || '∞'}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <select
                            value={editForm.is_active}
                            onChange={(e) => handleInputChange('is_active', e.target.value === 'true')}
                            className="form-select"
                            disabled={editLoading}
                          >
                            <option value={true}>Active</option>
                            <option value={false}>Inactive</option>
                          </select>
                        </div>
                      ) : (
                        <span className={`status ${promo.is_active ? 'active' : 'inactive'}`}>
                          {promo.is_active ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="date">{formatDate(promo.created_at)}</span>
                    </td>
                    <td>
                      {editingPromo === promo.id ? (
                        <div className="edit-field">
                          <input
                            type="date"
                            value={editForm.expires_at}
                            onChange={(e) => handleInputChange('expires_at', e.target.value)}
                            className="form-input"
                            min={new Date().toISOString().split('T')[0]}
                            disabled={editLoading}
                          />
                        </div>
                      ) : (
                        <span className="date">{promo.expires_at ? formatDate(promo.expires_at) : 'Never'}</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {editingPromo === promo.id ? (
                          <>
                            {editError && (
                              <div className="edit-error">
                                {editError}
                              </div>
                            )}
                            {editSuccess && (
                              <div className="edit-success">
                                ✓ Updated successfully!
                              </div>
                            )}
                            <button 
                              className="btn btn-success btn-sm"
                              onClick={handleSaveEdit}
                              disabled={editLoading}
                              title="Save changes"
                            >
                              {editLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            </button>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={handleCancelEdit}
                              disabled={editLoading}
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleEditPromo(promo)}
                              title="Edit promo code"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => deletePromoCode(promo.id)}
                              title="Delete promo code"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PromoCodes;