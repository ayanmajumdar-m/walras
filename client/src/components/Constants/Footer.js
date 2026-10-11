import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import './Footer.css';

/*
  Site footer, in the homepage's blueprint language: a dark field, kicker
  labels with sheet references, and a framed brand plate with corner ticks.
  Internal links go through the router; ScrollManager (App.js) then opens
  the page at its top, or at the #section the link names.
*/

const LOGO = 'https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png';

const COLUMNS = [
  {
    ref: 'F-01',
    title: 'Products',
    links: [
      { label: 'Virtual Machines', to: '/pricing#virtual-machine' },
      { label: 'App Platform', to: '/pricing#app-platform' },
      { label: 'Managed Database', to: '/pricing#managed-database' },
      { label: 'Domains', to: '/pricing#domains' },
      { label: 'Bare Metal', to: '/pricing#bare-metal' },
    ],
  },
  {
    ref: 'F-02',
    title: 'Resources',
    links: [
      { label: 'Pricing', to: '/pricing' },
      { label: 'Documentation', href: 'https://docs.walras.net' },
      { label: 'Status', href: 'https://status.walras.net' },
      { label: 'Contact Us', to: '/contact' },
    ],
  },
  {
    ref: 'F-03',
    title: 'Company',
    links: [
      { label: 'About Us', to: '/about' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
      { label: 'Refund Policy', to: '/refund' },
    ],
  },
];

const Corners = () => (
  <>
    <i className="corner tl" /><i className="corner tr" />
    <i className="corner bl" /><i className="corner br" />
  </>
);

const FooterLink = ({ label, to, href }) => (href ? (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {label} <ArrowUpRight size={13} aria-hidden="true" />
  </a>
) : (
  <Link to={to}>{label}</Link>
));

const Footer = () => (
  <footer className="footer field-dark">
    <div className="container">
      <div className="footer-head">
        <span className="kicker">Sheet 00 / Index</span>
        <span className="footer-rule" />
      </div>

      <div className="footer-main">
        <div className="footer-plate blueprint">
          <Corners />
          <Link to="/" className="footer-brand">
            <img src={LOGO} alt="" />
            <span>Walras Cloud</span>
          </Link>
          <p className="footer-description">
            From India, for India and the world: enterprise-grade cloud with local pricing, built just for you.
          </p>
          <div className="footer-actions">
            <a href="/login" className="btn btn-primary">Get Started</a>
            <Link to="/contact" className="btn footer-btn-ghost">Talk to us</Link>
          </div>
        </div>

        {COLUMNS.map(({ ref, title, links }) => (
          <nav className="footer-col" key={ref} aria-label={title}>
            <div className="footer-col-head">
              <span className="footer-ref">{ref}</span>
              <h4>{title}</h4>
            </div>
            <ul>
              {links.map((l) => <li key={l.label}><FooterLink {...l} /></li>)}
            </ul>
          </nav>
        ))}
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Noutikal Technologies. All rights reserved.</span>
        <span className="footer-made">Made in India</span>
      </div>
    </div>
  </footer>
);

export default Footer;
