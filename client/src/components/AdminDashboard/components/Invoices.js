import React, { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle, RefreshCw } from 'lucide-react';

const Invoices = ({ 
  invoices = [], 
  adminInfo, 
  formatDate 
}) => {
  const [message, setMessage] = useState({ text: '', type: '' });
  const [token, setToken] = useState(localStorage.getItem('adminToken'));

  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'overdue': return '#ef4444';
      default: return '#9ca3af';
    }
  };
    const API_URL='http://y0koc4ok88sk0cww0cwssco4.172.236.189.24.sslip.io' || 'http://localhost:3001';


  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/monthly-invoices?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Handle both wrapped and direct array responses
        const invoiceData = data.invoices || data;
        if (Array.isArray(invoiceData)) {
          // Update parent component if needed
          console.log('Invoices loaded:', invoiceData.length);
        }
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <div className="invoices-section">
      <div className="section-header">
        <h2>Invoices</h2>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const res = await fetch(`${API_URL}/api/admin/sample-invoice`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                  }
                });
                if (res.ok) {
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sample-invoice.pdf';
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } else {
                  alert('Failed to download sample invoice');
                }
              } catch (error) {
                console.error('Error downloading sample invoice:', error);
                alert('Error downloading sample invoice');
              }
            }}
          >
            <Download size={16} />
            Download Sample
          </button>
        </div>
      </div>

      <div className="invoices-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={20} />
          </div>
          <div className="stat-content">
            <h4>{safeInvoices.length}</h4>
            <p>Total Invoices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle size={20} />
          </div>
          <div className="stat-content">
            <h4>{safeInvoices.filter(i => i.status === 'paid').length}</h4>
            <p>Paid Invoices</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <FileText size={20} />
          </div>
          <div className="stat-content">
            <h4>{safeInvoices.filter(i => i.status === 'pending').length}</h4>
            <p>Pending Invoices</p>
          </div>
        </div>
      </div>

      <div className="invoices-table">
        <div className="table-container">
          <table className="table-wrapper">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>User</th>
                <th>Billing Month</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Generated</th>
                <th>Due Date</th>
                <th>Paid Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeInvoices.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty-state">
                    <div className="empty-icon">
                      <FileText size={48} />
                    </div>
                    <h3>No Invoices</h3>
                    <p>Generate monthly invoices to get started</p>
                    {adminInfo?.access === 'owner' && (
                      <button 
                        className="btn btn-primary"
                        onClick={async () => {
                          try {
                            const res = await fetch("http://localhost:3001/api/admin/generate-monthly-invoices", {
                              method: "POST",
                              headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache'
                              },
                            });
                            if (res.ok) {
                              setMessage({ text: "Monthly invoices generated successfully", type: "success" });
                              fetchInvoices();
                            } else {
                              throw new Error("Failed to generate invoices");
                            }
                          } catch (err) {
                            setMessage({ text: err.message || "Error generating invoices", type: "error" });
                          }
                        }}
                      >
                        <RefreshCw size={16} />
                        Generate Invoices
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                safeInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <div className="invoice-number">
                        <strong>{invoice.invoice_number}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">
                          {invoice.user_name ? invoice.user_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="user-name">{invoice.user_name}</div>
                          <div className="user-email">{invoice.user_email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="date">{formatDate(invoice.billing_month)}</span>
                    </td>
                    <td>
                      <span className="amount">₹{invoice.total_amount}</span>
                    </td>
                    <td>
                      <span 
                        className={`status ${invoice.status}`}
                        style={{ color: getStatusColor(invoice.status) }}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <span className="date">{formatDate(invoice.generated_at)}</span>
                    </td>
                    <td>
                      <span className="date">{formatDate(invoice.due_date)}</span>
                    </td>
                    <td>
                      <span className="date">{invoice.paid_at ? formatDate(invoice.paid_at) : 'Not paid'}</span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {invoice.status !== 'paid' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(`http://localhost:3001/api/admin/monthly-invoices/${invoice.id}/mark-paid`, {
                                  method: 'PUT',
                                  headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Cache-Control': 'no-cache',
                                    'Pragma': 'no-cache'
                                  }
                                });
                                if (res.ok) {
                                  alert('Invoice marked as paid!');
                                  window.location.reload();
                                } else {
                                  alert('Failed to mark invoice as paid');
                                }
                              } catch (error) {
                                console.error('Error marking invoice as paid:', error);
                                alert('Error marking invoice as paid');
                              }
                            }}
                            title="Mark as paid"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            try {
                              const res = await fetch(`http://localhost:3001/api/admin/monthly-invoices/${invoice.id}/download`, {
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Cache-Control': 'no-cache',
                                  'Pragma': 'no-cache'
                                }
                              });
                              if (res.ok) {
                                const blob = await res.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `invoice-${invoice.invoice_number}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                              } else {
                                alert('Failed to download invoice');
                              }
                            } catch (error) {
                              console.error('Error downloading invoice:', error);
                              alert('Error downloading invoice');
                            }
                          }}
                          title="Download invoice"
                        >
                          <Download size={16} />
                        </button>
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

export default Invoices;