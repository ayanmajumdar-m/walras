import React, { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, SlidersHorizontal, X, Server, Clock } from "lucide-react";
import "./Dedicated.css";

/*
  The Dedicated Servers catalog, shared by metal.walras.net (DedicatedServers.js)
  and the console (DashboardContent/Dedicated.js): category pills, search,
  filters with counts (location, delivery time, uplink, memory), sort, pages
  of 12 and a grid or list view. `action(server)` renders each card's button.
*/

const PAGE_SIZE = 12;

const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "memory-desc", label: "Most memory" },
  { id: "cores-desc", label: "Most cores" },
];

const COUNTRY_NAMES = {
  IN: "India", NL: "Netherlands", DE: "Germany", US: "United States", GB: "United Kingdom", FR: "France",
  SG: "Singapore", AE: "United Arab Emirates", JP: "Japan", AU: "Australia", CA: "Canada", FI: "Finland",
};

export const countryName = (cc) => COUNTRY_NAMES[cc] || cc;
export const flagUrl = (cc) => `https://flagcdn.com/w40/${String(cc).toLowerCase()}.png`;
export const formatUplink = (gbps) => (gbps < 1 ? `${Math.round(gbps * 1000)}Mbit/s` : `${Number(gbps)}Gbit/s`);
export const formatTraffic = (tb) => (tb > 0 ? `${tb.toLocaleString("en-IN")} TB traffic per month` : "Unmetered traffic");
export const formatInr = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const processorLine = (s) => `${s.cores} cores, ${s.threads} threads, ${Number(s.ghz).toFixed(2)}GHz`;

// Filter groups: how each reads a server, and how to label a value.
const GROUPS = [
  { id: "country", title: "Data center location", value: (s) => s.countryCode, label: (v) => `${v} - ${countryName(v)}` },
  { id: "delivery", title: "Time to deliver", value: (s) => s.delivery, label: (v, delivery) => delivery[v] || v, order: (delivery) => Object.keys(delivery) },
  { id: "uplink", title: "Uplink", value: (s) => `${s.uplinkGbps}|${s.trafficTb}`, label: (v) => {
      const [g, t] = v.split("|").map(Number);
      return `${formatUplink(g)} - ${t > 0 ? `${t}TB` : "Unmetered"}`;
    }, sort: (a, b) => a.split("|").map(Number)[0] - b.split("|").map(Number)[0] || a.split("|").map(Number)[1] - b.split("|").map(Number)[1] },
  { id: "memory", title: "Memory", value: (s) => String(s.memoryGb), label: (v) => `${v}GB`, sort: (a, b) => Number(a) - Number(b) },
];

const matchesSearch = (s, term) => !term || [
  s.cpu, s.brand, s.model, s.storage, s.network, s.location, countryName(s.countryCode),
  `${s.memoryGb}gb`, `${s.memoryGb} gb`, `${s.cores} cores`, `${s.threads} threads`,
].some((v) => String(v || "").toLowerCase().includes(term));

const Card = ({ s, delivery, action, view }) => (
  <article className={`ds-card${view === "list" ? " is-list" : ""}${s.inStock ? "" : " is-out"}`}>
    {s.badge && <span className="ds-ribbon" aria-label={s.badge}><span>{s.badge}</span></span>}
    <div className="ds-card-head">
      {(s.brand || s.model) && <p className="ds-card-model">{[s.brand, s.model].filter(Boolean).join(" ")}</p>}
      <h3 className="ds-card-cpu">{s.cpu}</h3>
      <div className="ds-card-tags">
        <span className="ds-loc">
          <img src={flagUrl(s.countryCode)} alt="" width="18" height="13" loading="lazy" />
          {s.location || countryName(s.countryCode)}
        </span>
        <span className="ds-delivery"><Clock size={13} aria-hidden="true" /> {delivery[s.delivery]?.split(" - ")[0] || s.delivery}</span>
      </div>
    </div>
    <dl className="ds-specs">
      <div><dt>Processor</dt><dd>{processorLine(s)}</dd></div>
      <div><dt>Memory</dt><dd>{s.memoryGb}GB</dd></div>
      <div><dt>Storage</dt><dd>{s.storage}</dd></div>
      <div><dt>Network</dt><dd>{s.network}<small>{formatTraffic(s.trafficTb)}</small></dd></div>
    </dl>
    <div className="ds-card-foot">
      <div className="ds-price">
        <strong>{formatInr(s.monthly)}</strong><span>/month</span>
        <small>{s.inStock ? (s.fewLeft ? `Only ${s.fewLeft} left` : "Excl. GST") : "Out of stock"}</small>
      </div>
      {action(s)}
    </div>
  </article>
);

const DedicatedCatalog = ({ servers, categories, delivery: deliveryLabels, action, loading, error }) => {
  const delivery = deliveryLabels || {};
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("grid");
  const [closed, setClosed] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const term = search.trim().toLowerCase();
  const list = useMemo(() => servers || [], [servers]);

  // Category and search narrow everything; each filter group then counts
  // what the other groups leave.
  const base = useMemo(() => list.filter((s) => (!category || s.categories.includes(category)) && matchesSearch(s, term)), [list, category, term]);
  const passes = (s, except) => GROUPS.every((g) => g.id === except || !filters[g.id] || g.value(s) === filters[g.id]);
  const shown = useMemo(() => {
    const out = base.filter((s) => passes(s));
    const by = {
      "price-asc": (a, b) => a.monthly - b.monthly,
      "price-desc": (a, b) => b.monthly - a.monthly,
      "memory-desc": (a, b) => b.memoryGb - a.memoryGb || a.monthly - b.monthly,
      "cores-desc": (a, b) => b.cores - a.cores || a.monthly - b.monthly,
    }[sort];
    // In-stock servers first, whatever the order.
    return [...out].sort((a, b) => (b.inStock - a.inStock) || (by ? by(a, b) : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, filters, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const setFilter = (id, v) => { setFilters((f) => ({ ...f, [id]: v })); setPage(1); };
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const facets = GROUPS.map((g) => {
    const pool = base.filter((s) => passes(s, g.id));
    const counts = new Map();
    pool.forEach((s) => counts.set(g.value(s), (counts.get(g.value(s)) || 0) + 1));
    let values = [...new Set(list.map(g.value))];
    if (g.order) values = g.order(delivery).filter((v) => values.includes(v));
    else if (g.sort) values.sort(g.sort);
    else values.sort();
    return { ...g, total: pool.length, options: values.map((v) => ({ v, label: g.label(v, delivery), n: counts.get(v) || 0 })) };
  }).filter((g) => g.options.length > 1 || filters[g.id]);

  const go = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loading) return <div className="ds-empty"><p>Loading servers…</p></div>;
  if (error) return <div className="ds-empty"><p>{error}</p></div>;
  if (!list.length) {
    return (
      <div className="ds-empty">
        <Server size={28} aria-hidden="true" />
        <h3>Dedicated servers are coming soon</h3>
        <p>We're adding the first machines now. Contact us if you need one today.</p>
        <a href="/contact" className="ds-btn ds-btn-ghost">Talk to us</a>
      </div>
    );
  }

  return (
    <div className="ds-catalog">
      <aside className={`ds-filters${filtersOpen ? " is-open" : ""}`} aria-label="Filters">
        <div className="ds-filters-head">
          <h2>Filter</h2>
          {activeFilters > 0 && <button type="button" className="ds-link" onClick={() => { setFilters({}); setPage(1); }}>Clear all</button>}
          <button type="button" className="ds-icon-btn ds-filters-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button>
        </div>
        {facets.map((g) => (
          <section key={g.id} className="ds-group">
            <button type="button" className="ds-group-head" aria-expanded={!closed[g.id]} onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))}>
              <span>{g.title}</span>
              <ChevronDown size={18} className={closed[g.id] ? "" : "is-open"} aria-hidden="true" />
            </button>
            {!closed[g.id] && (
              <div className="ds-options" role="radiogroup" aria-label={g.title}>
                <label className="ds-radio">
                  <input type="radio" name={`ds-${g.id}`} checked={!filters[g.id]} onChange={() => setFilter(g.id, null)} />
                  <span>All ({g.total})</span>
                </label>
                {g.options.map((o) => (
                  <label key={o.v} className={`ds-radio${o.n === 0 ? " is-empty" : ""}`}>
                    <input type="radio" name={`ds-${g.id}`} checked={filters[g.id] === o.v} onChange={() => setFilter(g.id, o.v)} />
                    <span>{o.label} ({o.n})</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        ))}
      </aside>

      <div className="ds-main">
        <div className="ds-pills" role="group" aria-label="Category">
          {Object.entries(categories || {}).map(([id, label]) => (
            <button key={id} type="button" className={`ds-pill${category === id ? " is-active" : ""}`} aria-pressed={category === id}
              onClick={() => { setCategory(category === id ? null : id); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>

        <label className="ds-search">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search on CPU, RAM and more" aria-label="Search servers" />
          {search ? (
            <button type="button" className="ds-icon-btn" onClick={() => setSearch("")} aria-label="Clear search"><X size={18} /></button>
          ) : <Search size={20} aria-hidden="true" />}
        </label>

        <div className="ds-toolbar">
          <span className="ds-count">{shown.length} result{shown.length === 1 ? "" : "s"}</span>
          {pages > 1 && (
            <nav className="ds-pager" aria-label="Pages">
              <button type="button" className="ds-icon-btn" onClick={() => go(current - 1)} disabled={current === 1} aria-label="Previous page"><ChevronLeft size={18} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" className={`ds-page${p === current ? " is-active" : ""}`} aria-current={p === current ? "page" : undefined} onClick={() => go(p)}>{p}</button>
              ))}
              <button type="button" className="ds-icon-btn" onClick={() => go(current + 1)} disabled={current === pages} aria-label="Next page"><ChevronRight size={18} /></button>
            </nav>
          )}
          <span className="ds-toolbar-spacer" />
          <button type="button" className="ds-btn ds-btn-ghost ds-filters-toggle" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} /> Filters{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          <label className="ds-sort">
            <span className="ds-visually-hidden">Sort by</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </label>
          <button type="button" className="ds-icon-btn" onClick={() => setView(view === "grid" ? "list" : "grid")}
            aria-label={view === "grid" ? "Show as a list" : "Show as a grid"} title={view === "grid" ? "List view" : "Grid view"}>
            {view === "grid" ? <List size={20} /> : <LayoutGrid size={20} />}
          </button>
        </div>

        {pageItems.length === 0 ? (
          <div className="ds-empty"><p>No servers match. Try fewer filters or another search.</p></div>
        ) : (
          <div className={`ds-grid${view === "list" ? " is-list" : ""}`}>
            {pageItems.map((s) => <Card key={s.id} s={s} delivery={delivery} action={action} view={view} />)}
          </div>
        )}
      </div>
      {filtersOpen && <div className="ds-scrim" onClick={() => setFiltersOpen(false)} aria-hidden="true" />}
    </div>
  );
};

export default DedicatedCatalog;
