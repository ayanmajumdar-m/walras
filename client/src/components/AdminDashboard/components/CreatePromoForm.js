import React, { useState } from 'react';

const CreatePromoForm = ({ onSuccess, onCancel }) => {
  const API_URL='https://superflare.io' || 'http://localhost:3001';
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    creditAmount: '',
    usageLimit: '',
    expiresAt: ''
  });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("adminToken");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/admin/promo-codes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: formData.code.toUpperCase(),
          description: formData.description,
          creditAmount: parseFloat(formData.creditAmount),
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          expiresAt: formData.expiresAt || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert("Promo code created successfully!");
        onSuccess();
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error creating promo code:", error);
      alert("Failed to create promo code");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="create-promo-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create New Promo Code</h3>
          <button onClick={onCancel} className="close-btn">×</button>
        </div>
        <form onSubmit={handleSubmit} className="promo-form">
        <div className="form-group">
          <label htmlFor="code">Promo Code *</label>
          <input
            type="text"
            id="code"
            name="code"
            value={formData.code}
            onChange={handleChange}
            required
            placeholder="Enter promo code"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter description (optional)"
            rows="3"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="creditAmount">Credit Amount *</label>
          <input
            type="number"
            id="creditAmount"
            name="creditAmount"
            value={formData.creditAmount}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            placeholder="Enter credit amount"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="usageLimit">Usage Limit</label>
          <input
            type="number"
            id="usageLimit"
            name="usageLimit"
            value={formData.usageLimit}
            onChange={handleChange}
            min="1"
            placeholder="Enter usage limit (optional)"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="expiresAt">Expiry Date</label>
          <input
            type="datetime-local"
            id="expiresAt"
            name="expiresAt"
            value={formData.expiresAt}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Promo Code'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePromoForm;
