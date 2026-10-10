import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, Mail } from 'lucide-react';
import './Legal.css';

/*
  Shared layout for the legal pages (Privacy, Terms, Refund), in the same
  visual language as About and Pricing: dark teal hero, white cards, a
  sticky contents rail that follows the scroll, and the dark CTA band.

  Section content is plain text, one paragraph per line:
    "• text"  → a bullet (consecutive bullets form one list)
    "1.1 text" → a sub-heading
*/

const DOCS = [
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms of Service' },
  { path: '/refund', label: 'Refund Policy' },
];

const SUPPORT_EMAIL = 'support@walras.net';

const slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The support address becomes a mailto link wherever it appears.
const withLinks = (text) => text.split(SUPPORT_EMAIL).flatMap((part, i) => (
  i === 0 ? [part] : [<a key={i} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, part]
));

const Body = ({ content }) => {
  const blocks = [];
  for (const line of content.split('\n')) {
    if (line.startsWith('• ')) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') last.items.push(line.slice(2));
      else blocks.push({ type: 'list', items: [line.slice(2)] });
    } else if (/^\d+\.\d+ /.test(line)) {
      blocks.push({ type: 'sub', text: line });
    } else if (line.trim()) {
      blocks.push({ type: 'p', text: line });
    }
  }
  return blocks.map((b, i) => {
    if (b.type === 'list') return <ul key={i}>{b.items.map((t, j) => <li key={j}>{withLinks(t)}</li>)}</ul>;
    if (b.type === 'sub') return <h3 key={i}>{b.text}</h3>;
    return <p key={i}>{withLinks(b.text)}</p>;
  });
};

const LegalPage = ({ path, title, intro = [], effective, updated, sections }) => {
  const items = sections.map((s) => ({ ...s, id: slug(s.title) }));
  const [active, setActive] = useState(items[0]?.id);

  // Highlight the section being read in the contents rail: the last one
  // whose top has passed just below the sticky navbar.
  useEffect(() => {
    const onScroll = () => {
      let current = items[0]?.id;
      for (const s of items) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 120) current = s.id;
      }
      // At the very bottom, the last short sections can't reach the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = items[items.length - 1]?.id;
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className="lg-page">
      <header className="lg-hero">
        <div className="lg-wrap">
          <nav className="lg-docs" aria-label="Legal documents">
            {DOCS.map((d) => (
              <Link key={d.path} to={d.path} className={`lg-doc${d.path === path ? ' is-active' : ''}`} aria-current={d.path === path ? 'page' : undefined}>
                {d.label}
              </Link>
            ))}
          </nav>
          <span className="lg-kicker">Legal</span>
          <h1 className="lg-title">{title}</h1>
          {intro.map((p, i) => <p className="lg-intro" key={i}>{p}</p>)}
          <dl className="lg-meta">
            <div><dt>Effective</dt><dd>{effective}</dd></div>
            {updated && <div><dt>Last updated</dt><dd>{updated}</dd></div>}
            <div><dt>Operated by</dt><dd>Noutikal Technologies</dd></div>
            <div><dt>Contact</dt><dd><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></dd></div>
          </dl>
        </div>
      </header>

      <div className="lg-wrap lg-layout">
        <aside className="lg-rail">
          <span className="lg-rail-title">On this page</span>
          <ol>
            {items.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={active === s.id ? 'is-active' : undefined}>{s.title}</a>
              </li>
            ))}
          </ol>
        </aside>

        <main className="lg-doc-body">
          {items.map((s) => (
            <section className="lg-card" id={s.id} key={s.id}>
              <h2>{s.title}</h2>
              <Body content={s.content} />
            </section>
          ))}
        </main>
      </div>

      <section className="lg-cta">
        <div className="lg-wrap lg-cta-inner">
          <div>
            <h2>Questions about this policy?</h2>
            <p>From India, for India and the world — enterprise-grade cloud with local pricing, built for you.</p>
          </div>
          <div className="lg-cta-actions">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="lg-btn lg-btn-primary"><Mail aria-hidden="true" /> Email support</a>
            <Link to="/contact" className="lg-btn lg-btn-ghost"><Headphones aria-hidden="true" /> Contact us</Link>
            <Link to="/pricing" className="lg-btn lg-btn-ghost">See pricing <ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LegalPage;
