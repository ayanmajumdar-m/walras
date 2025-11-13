import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const TransferDomainModal = ({ open, onClose, onTransfer, domainName = '' }) => {
  const [authCode, setAuthCode] = useState('');
  const [ns1, setNs1] = useState('');
  const [ns2, setNs2] = useState('');
  const [ownerHandle, setOwnerHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setAuthCode('');
    setNs1('');
    setNs2('');
    setOwnerHandle('');
    setError('');
    setLoading(false);
  }, [open, domainName]);

  if (!open) return null;

  const validateHostname = (host) => {
    if (!host) return false;
    const h = host.trim();
    const parts = h.split('.');
    if (parts.length < 2) return false;
    const labelRe = /^[a-zA-Z0-9-]{1,63}$/;
    return parts.every(p => labelRe.test(p) && !p.startsWith('-') && !p.endsWith('-'));
  };

  const handleSubmit = async () => {
    setError('');
    if (!authCode || authCode.trim().length < 4) return setError('Auth code is required');

    const nameservers = [];
    if (ns1.trim()) {
      if (!validateHostname(ns1)) return setError('Invalid NS1');
      nameservers.push(ns1.trim());
    }
    if (ns2.trim()) {
      if (!validateHostname(ns2)) return setError('Invalid NS2');
      nameservers.push(ns2.trim());
    }

    setLoading(true);
    try {
      await onTransfer({ auth_code: authCode.trim(), nameservers, handles: ownerHandle ? { owner: ownerHandle.trim() } : {} });
    } catch (err) {
      setError(err?.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Transfer Domain</h3>
        <div className="modal-row">
          <label>Domain</label>
          <input value={domainName} readOnly />
        </div>
        <div className="modal-row">
          <label>Auth Code (EPP)</label>
          <input value={authCode} onChange={e => setAuthCode(e.target.value)} placeholder="Enter transfer auth/EPP code" />
        </div>
        {/* <div className="modal-row">
          <label>Owner Handle (optional)</label>
          <input value={ownerHandle} onChange={e => setOwnerHandle(e.target.value)} placeholder="e.g. CV904717-NL" />
        </div>
        <div className="modal-row">
          <label>Nameserver 1 (optional)</label>
          <input value={ns1} onChange={e => setNs1(e.target.value)} placeholder="e.g. ns1.example.com" />
        </div>
        <div className="modal-row">
          <label>Nameserver 2 (optional)</label>
          <input value={ns2} onChange={e => setNs2(e.target.value)} placeholder="e.g. ns2.example.com" />
        </div> */}
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button className="btn secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Submitting...' : 'Initiate Transfer'}</button>
        </div>
      </div>
    </div>
  );
};

export default TransferDomainModal;
