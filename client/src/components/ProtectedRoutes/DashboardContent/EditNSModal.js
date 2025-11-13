import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const EditNSModal = ({ open, onClose, onSave, initialNs = [] }) => {
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNs1(initialNs[0] || '');
    setNs2(initialNs[1] || '');
    setError('');
  }, [initialNs, open]);

  if (!open) return null;

  const validateHostname = (host) => {
    if (!host || typeof host !== 'string') return false;
    const h = host.trim();
    // basic hostname validation: labels separated by dots, labels 1-63 chars, only letters, digits, hyphen
    const parts = h.split('.');
    if (parts.length < 2) return false;
    const labelRe = /^[a-zA-Z0-9-]{1,63}$/;
    return parts.every(p => labelRe.test(p) && !p.startsWith('-') && !p.endsWith('-'));
  };

  const handleSave = async () => {
    setError('');
    if (!validateHostname(ns1)) return setError('Invalid NS1 hostname');
    if (!validateHostname(ns2)) return setError('Invalid NS2 hostname');
    setLoading(true);
    try {
      await onSave([ns1.trim(), ns2.trim()]);
    } catch (err) {
      setError(err?.message || 'Failed to update nameservers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Edit Nameservers</h3>
        <div className="modal-row">
          <label>NS1</label>
          <input value={ns1} onChange={e => setNs1(e.target.value)} placeholder="e.g. ns1.example.com" />
        </div>
        <div className="modal-row">
          <label>NS2</label>
          <input value={ns2} onChange={e => setNs2(e.target.value)} placeholder="e.g. ns2.example.com" />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

export default EditNSModal;
