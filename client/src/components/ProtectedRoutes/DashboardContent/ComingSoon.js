import React from 'react';
import { Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ComingSoon.css';

const ComingSoon = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <div className="coming-soon-container">
      <div className="coming-soon-card blueprint">
        <span className="coming-soon-kicker">COMING SOON</span>
        <h1 className="coming-soon-heading">{title || "Feature Coming Soon"}</h1>
        <p className="coming-soon-text">
          {description || "We are working hard to bring this feature to Buttr Cloud Console. Stay tuned for updates!"}
        </p>
        
        <div className="coming-soon-badge">
          <Clock size={16} />
          <span>Under Active Development</span>
        </div>

        <div className="coming-soon-actions">
          <button onClick={() => navigate('/dashboard/home')} className="btn btn-primary">
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
