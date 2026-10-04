import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <h3 className="footer-title">Walras Cloud</h3>
            <p className="footer-description">
              From India for India and the world, Walras Cloud delivers enterprise-grade cloud with local pricing, built just for you :)
            </p>
          </div>

          <div className="footer-links-group">
            <h4 className="footer-subtitle">Important Links</h4>
            <ul className="footer-links">
              <li><Link to="/pricing#domains">Domains</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><a href='https://status.buttr.cloud'>Status</a></li>
              <li><a href='https://help.buttr.cloud'>Documentation</a></li>
            </ul>
          </div>

          <div className="footer-links-group">
            <h4 className="footer-subtitle">Company</h4>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/refund">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="copyright">
            © 2025 IOOGN TECHNOLOGIES OPC PVT LTD. All rights reserved.
          </p>
          <p className="copyright">Mumbai, India · London, UK</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
