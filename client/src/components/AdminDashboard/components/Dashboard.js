import React from 'react';
import { Users, Server, DollarSign, BarChart3, Hash, Clock } from 'lucide-react';

const Dashboard = ({ dashboardStats, recentActivity, formatCurrency, formatDate }) => {
  // Ensure recentActivity is always an array
  const safeRecentActivity = Array.isArray(recentActivity) ? recentActivity : [];
  return (
    <div className="dashboard-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{dashboardStats.total_users || 0}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Server size={24} />
          </div>
          <div className="stat-content">
            <h3>{dashboardStats.active_servers || 0}</h3>
            <p>Active Servers</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>{formatCurrency(dashboardStats.total_revenue || 0)}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <BarChart3 size={24} />
          </div>
          <div className="stat-content">
            <h3>{dashboardStats.total_transactions || 0}</h3>
            <p>Total Transactions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Hash size={24} />
          </div>
          <div className="stat-content">
            <h3>{dashboardStats.unique_ips || 0}</h3>
            <p>Unique IPs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{dashboardStats.active_sessions || 0}</h3>
            <p>Active Sessions</p>
          </div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {safeRecentActivity.slice(0, 10).map((activity, index) => (
            <div key={index} className="activity-item">
              <div className="activity-icon">
                {activity.activity_type === 'login' ? <Clock size={16} /> : <DollarSign size={16} />}
              </div>
              <div className="activity-content">
                <p><strong>{activity.user_name}</strong> - {activity.description}</p>
                <small>{formatDate(activity.activity_time)}</small>
                {activity.ip_address && <small> • IP: {activity.ip_address}</small>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
