import React, { useEffect, useState, useRef } from "react";
import "./Logs.css";

const Logs = () => {
  const [balance, setBalance] = useState(0);
  const [unbilled, setUnbilled] = useState(0);
  const [nextInvoiceDate, setNextInvoiceDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const API_URL = `http://y0koc4ok88sk0cww0cwssco4.172.236.189.24.sslip.io`
  
  const token = localStorage.getItem("token");
  const logsEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // Scroll to bottom of logs
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // ✅ FIXED: Correct wallet endpoint
  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:3001/api/wallet", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(parseFloat(data.balance));
        setUnbilled(parseFloat(data.unbilled));
        setNextInvoiceDate(data.nextInvoiceDate);
      } else {
        console.error("Wallet fetch failed:", data);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  // ✅ Fetch both billing history and wallet transactions
  const fetchLogs = async () => {
    if (!token) return;
    try {
      // Fetch billing history and wallet transactions in parallel
      const [billingRes, transactionsRes] = await Promise.all([
        fetch("http://localhost:3001/api/users/wallet/billing-history", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch("http://localhost:3001/api/wallet/transactions", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
      ]);

      const billingData = await billingRes.json();
      const transactionsData = await transactionsRes.json();

      if (billingRes.ok && transactionsRes.ok) {
        // Combine and sort all logs by date
        const allLogs = [
          ...(billingData.billingHistory || []).map(log => ({
            ...log,
            type: 'billing',
            amount: parseFloat(log.amount),
            date: log.billing_period || log.created_at
          })),
          ...(transactionsData.transactions || []).map(tx => ({
            ...tx,
            type: 'wallet',
            amount: tx.type === 'credit' ? parseFloat(tx.amount) : -parseFloat(tx.amount),
            date: tx.created_at
          }))
        ];

        // Sort by date (newest first)
        allLogs.sort((a, b) => new Date(b.date) - new Date(a.date));
        setLogs(allLogs);
      } else {
        console.error("Logs fetch failed:", billingData, transactionsData);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  // Fetch all data
  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchWallet(), fetchLogs()]);
    setLoading(false);
  };

  // Setup auto-refresh
  useEffect(() => {
    fetchAllData();

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchAllData, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, token]);

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  // Manually refresh
  const handleManualRefresh = () => {
    fetchAllData();
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Calculate total deductions
  const totalDeductions = logs
    .filter(log => log.amount && parseFloat(log.amount) > 0)
    .reduce((sum, log) => sum + parseFloat(log.amount), 0);

  return (
    <div className="logs-container">
      {/* Header */}
      <div className="logs-header">
        <h1>Billing & Usage Logs</h1>
        <div className="refresh-controls">
          <button 
            className={`refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={toggleAutoRefresh}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button 
            className="manual-refresh-btn"
            onClick={handleManualRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Wallet Summary */}
      <div className="wallet-summary-cards">
        <div className="summary-card balance-card">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Available Balance</h3>
            <p className="card-value">₹{balance.toFixed(2)}</p>
            <div className="balance-update-time">
              Last: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        <div className="summary-card unbilled-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Total Deductions</h3>
            <p className="card-value">₹{totalDeductions.toFixed(2)}</p>
            <div className="deductions-count">
              From {logs.length} transactions
            </div>
          </div>
        </div>
        
        <div className="summary-card invoice-card">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <h3>Next Invoice</h3>
            <p className="card-value">{nextInvoiceDate || 'Not set'}</p>
            <div className="invoice-note">
              Generated monthly
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Total Logs:</span>
          <span className="stat-value">{logs.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Last Updated:</span>
          <span className="stat-value">{new Date().toLocaleTimeString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Auto Refresh:</span>
          <span className={`stat-value ${autoRefresh ? 'active' : 'inactive'}`}>
            {autoRefresh ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Status:</span>
          <span className="stat-value live">LIVE</span>
        </div>
      </div>

      {/* Logs Section */}
      <div className="logs-section">
        <div className="logs-header-bar">
          <h2>Real-time Billing Logs</h2>
          <div className="logs-count">
            Showing {logs.length} entries • Updates every 10 seconds
          </div>
        </div>

        <div className="logs-table-container">
          {logs.length === 0 ? (
            <div className="no-logs">
              <div className="no-logs-icon">📝</div>
              <h3>No billing logs yet</h3>
              <p>Your server usage and billing logs will appear here every 10 seconds</p>
              <div className="no-logs-hint">
                ⚡ Make sure you have active servers and the billing service is running
              </div>
            </div>
          ) : (
            <div className="logs-table">
              <div className="logs-table-header">
                <div className="log-column time">Time</div>
                <div className="log-column description">Description</div>
                <div className="log-column amount">Amount</div>
                <div className="log-column status">Status</div>
              </div>
              
              <div className="logs-table-body">
                {logs.map((log, index) => (
                  <div key={index} className="log-row">
                    <div className="log-column time">
                      <div className="log-time">{formatDate(log.date || log.created_at)}</div>
                      <div className="log-time-ago">
                        {getTimeAgo(log.date || log.created_at)}
                      </div>
                    </div>
                    <div className="log-column description">
                      <div className="log-description">{log.description}</div>
                      <div className="log-type">{log.type || 'billing'}</div>
                    </div>
                    <div className="log-column amount">
                      <div className={`log-amount ${parseFloat(log.amount) > 0 ? 'debit' : 'credit'}`}>
                        {parseFloat(log.amount) > 0 ? '-' : '+'}₹{Math.abs(parseFloat(log.amount)).toFixed(2)}
                      </div>
                    </div>
                    <div className="log-column status">
                      <div className="log-status completed">
                        <span className="status-dot"></span>
                        Completed
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Indicator */}
      {autoRefresh && (
        <div className="live-indicator">
          <div className="pulse-dot"></div>
          <span>LIVE - Auto updating every 10 seconds</span>
          <span className="update-count">
            • Next update in: <CountdownTimer />
          </span>
        </div>
      )}
    </div>
  );
};

// ✅ ADD: Countdown timer component
const CountdownTimer = () => {
  const [seconds, setSeconds] = useState(3600);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) return 3600;
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return <span>{seconds}s</span>;
};

// ✅ ADD: Time ago function
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour ago`;
  return `${Math.floor(diffInSeconds / 86400)} day ago`;
};

export default Logs;