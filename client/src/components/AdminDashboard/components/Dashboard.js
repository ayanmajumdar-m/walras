import React from 'react';
import { Users, Server, DollarSign, BarChart3, Hash, Clock } from 'lucide-react';

/*
  Dashboard overview — Industry spec-sheet style.
  Stats are hairline-divided cells with large condensed figures.
  Activity is a spec-sheet list with row dividers.
*/

const STAT_DEFS = [
  { ref: 'S-01', Icon: Users,    key: 'total_users',        label: 'Total Users',        fmt: v => v },
  { ref: 'S-02', Icon: Server,   key: 'active_servers',     label: 'Active Servers',     fmt: v => v },
  { ref: 'S-03', Icon: DollarSign, key: 'total_revenue',    label: 'Total Revenue',      fmt: null },
  { ref: 'S-04', Icon: BarChart3, key: 'total_transactions',label: 'Transactions',       fmt: v => v },
  { ref: 'S-05', Icon: Hash,     key: 'unique_ips',         label: 'Unique IPs',         fmt: v => v },
  { ref: 'S-06', Icon: Clock,    key: 'active_sessions',    label: 'Active Sessions',    fmt: v => v },
];

const Dashboard = ({ dashboardStats, recentActivity, formatCurrency, formatDate }) => {
  const safeRecentActivity = Array.isArray(recentActivity) ? recentActivity : [];

  return (
    <div className="dashboard-overview">
      {/* ── Stats grid ── */}
      <div>
        <div className="section-header">
          <h3>Overview</h3>
          <span className="section-rule" />
          <span className="section-note">Live platform metrics</span>
        </div>

        <div className="stats-grid">
          {STAT_DEFS.map(({ ref, Icon, key, label, fmt }) => {
            const raw = dashboardStats[key] || 0;
            const display = fmt ? fmt(raw) : formatCurrency(raw);
            return (
              <div className="stat-card" key={ref}>
                <div className="stat-card-head">
                  <span className="stat-card-ref">{ref}</span>
                  <span className="stat-icon"><Icon size={18} strokeWidth={1.5} /></span>
                </div>
                <div className="figure-lg">{display}</div>
                <div className="figure-label">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div>
        <div className="section-header">
          <h3>Recent Activity</h3>
          <span className="section-rule" />
          <span className="section-note">Last {Math.min(safeRecentActivity.length, 10)} events</span>
        </div>

        <div className="recent-activity-section">
          <div className="activity-list">
            {safeRecentActivity.length === 0 ? (
              <div className="activity-item">
                <div className="activity-icon"><Clock size={16} strokeWidth={1.5} /></div>
                <div className="activity-content">
                  <p>No recent activity</p>
                </div>
              </div>
            ) : (
              safeRecentActivity.slice(0, 10).map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.activity_type === 'login'
                      ? <Clock size={16} strokeWidth={1.5} />
                      : <DollarSign size={16} strokeWidth={1.5} />}
                  </div>
                  <div className="activity-content">
                    <p><strong>{activity.user_name}</strong> — {activity.description}</p>
                    <small>{formatDate(activity.activity_time)}</small>
                    {activity.ip_address && <small> · IP: {activity.ip_address}</small>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
