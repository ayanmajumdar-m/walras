import React, { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, SlidersHorizontal, X, Server, Clock } from "lucide-react";
import "./Dedicated.css";

/*
  The Dedicated catalog, shared by metal.walras.net (DedicatedServers.js)
  and the console (DashboardContent/Dedicated.js): category pills, search,
  filters, sort, pages of 12 and a grid or list view. `action(server)`
  renders each card's button.

  Filters: Region, Price (a range slider), CPU, RAM, Storage, Uplink, Server
  type / purpose (the same as the category pills above the search), Availability
  and Time to deliver. Options are only what the listings actually have, each with a
  count; several can be ticked in a group (any of them), and groups combine
  (all of them). A group with a single option isn't shown. What's selected
  shows as chips above the results, each removable, with Clear all.
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

// Checkbox filter groups, in the order shown (Price sits after Region):
// how each reads a server, labels a value and orders its options.
const byNumber = (a, b) => Number(a) - Number(b);
const GROUPS = [
  { id: "region", title: "Region", value: (s) => s.countryCode, label: (v) => `${countryName(v)} (${v})`, chip: (v) => countryName(v) },
  { id: "cpu", title: "CPU", value: (s) => s.cpu, label: (v) => v },
  { id: "ram", title: "RAM", value: (s) => String(s.memoryGb), label: (v) => `${v}GB`, sort: byNumber },
  { id: "storage", title: "Storage", value: (s) => s.storage, label: (v) => v },
  { id: "uplink", title: "Uplink", value: (s) => `${s.uplinkGbps}|${s.trafficTb}`, label: (v) => {
      const [g, t] = v.split("|").map(Number);
      return `${formatUplink(g)} - ${t > 0 ? `${t}TB` : "Unmetered"}`;
    }, sort: (a, b) => { const [ga, ta] = a.split("|").map(Number); const [gb, tb] = b.split("|").map(Number); return ga - gb || ta - tb; } },
  // A server can have several purposes (its categories); the pills above the search tick these too.
  { id: "purpose", title: "Server type / purpose", values: (s) => s.categories, label: (v, ctx) => ctx.categories[v] || v, order: (ctx) => Object.keys(ctx.categories) },
  { id: "availability", title: "Availability", value: (s) => (s.inStock ? "in" : "out"), label: (v) => (v === "in" ? "In stock" : "Out of stock"), order: () => ["in", "out"] },
  { id: "delivery", title: "Time to deliver", value: (s) => s.delivery, label: (v, ctx) => ctx.delivery[v] || v, order: (ctx) => Object.keys(ctx.delivery) },
];
const valuesOf = (g, s) => (g.values ? g.values(s) : [g.value(s)]);
const SHOW_FIRST = 6; // longer groups show "Show more"

// Price slider steps: about 100 across the range, in round rupees.
const priceStep = (lo, hi) => {
  const raw = Math.max(1, (hi - lo) / 100);
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= raw) || mag * 10;
};

const PriceRange = ({ bounds, value, onChange }) => {
  const [lo, hi] = value || bounds;
  const step = priceStep(bounds[0], bounds[1]);
  const pct = (v) => ((v - bounds[0]) / (bounds[1] - bounds[0] || 1)) * 100;
  const set = (a, b) => onChange(a <= bounds[0] && b >= bounds[1] ? null : [a, b]);
  return (
    <div className="ds-price-filter">
      <div className="ds-price-values"><span>{formatInr(lo)}</span><span>{formatInr(hi)}</span></div>
      <div className="ds-range">
        <span className="ds-range-track" />
        <span className="ds-range-fill" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input type="range" min={bounds[0]} max={bounds[1]} step={step} value={lo} aria-label="Lowest price"
          onChange={(e) => set(Math.min(Number(e.target.value), hi), hi)} />
        <input type="range" min={bounds[0]} max={bounds[1]} step={step} value={hi} aria-label="Highest price"
          onChange={(e) => set(lo, Math.max(Number(e.target.value), lo))} />
      </div>
      <small className="ds-price-note">Per month, excluding GST</small>
    </div>
  );
};

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
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({}); // group id → ticked values
  const [price, setPrice] = useState(null); // [min, max], or null for any price
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [view, setView] = useState("grid");
  const [closed, setClosed] = useState({});
  const [expanded, setExpanded] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const term = search.trim().toLowerCase();
  const list = useMemo(() => servers || [], [servers]);
  const bounds = useMemo(() => (list.length
    ? [Math.floor(Math.min(...list.map((s) => s.monthly))), Math.ceil(Math.max(...list.map((s) => s.monthly)))]
    : [0, 0]), [list]);

  // Category and search narrow everything; each filter group then counts
  // what the other groups (and the price range) leave.
  const base = useMemo(() => list.filter((s) => matchesSearch(s, term)), [list, term]);
  const ctx = { delivery, categories: categories || {} };
  const passes = (s, except) => (except === "price" || !price || (s.monthly >= price[0] && s.monthly <= price[1]))
    && GROUPS.every((g) => g.id === except || !filters[g.id]?.length || valuesOf(g, s).some((v) => filters[g.id].includes(v)));
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
  }, [base, filters, price, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageItems = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const toggle = (id, v) => {
    setFilters((f) => {
      const now = f[id] || [];
      return { ...f, [id]: now.includes(v) ? now.filter((x) => x !== v) : [...now, v] };
    });
    setPage(1);
  };
  const changePrice = (v) => { setPrice(v); setPage(1); };
  const clearAll = () => { setFilters({}); setPrice(null); setPage(1); };

  const facets = GROUPS.map((g) => {
    const pool = base.filter((s) => passes(s, g.id));
    const counts = new Map();
    pool.forEach((s) => valuesOf(g, s).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
    let values = [...new Set(list.flatMap((s) => valuesOf(g, s)))];
    if (g.order) values = g.order(ctx).filter((v) => values.includes(v));
    else values.sort(g.sort || ((a, b) => a.localeCompare(b)));
    return { ...g, options: values.map((v) => ({ v, label: g.label(v, ctx), n: counts.get(v) || 0 })) };
  }).filter((g) => g.options.length > 1 || filters[g.id]?.length);

  // Selected filters, as chips above the results.
  const chips = [
    ...(price ? [{ key: "price", label: `${formatInr(price[0])} – ${formatInr(price[1])}`, remove: () => changePrice(null) }] : []),
    ...GROUPS.flatMap((g) => (filters[g.id] || []).map((v) => ({
      key: `${g.id}:${v}`, label: (g.chip || g.label)(v, ctx), remove: () => toggle(g.id, v),
    }))),
  ];
  const activeFilters = chips.length;

  // Price comes right after Region (or first, when Region isn't shown).
  const priceAt = facets[0]?.id === "region" ? 1 : 0;
  const priceGroup = bounds[1] > bounds[0] && (
    <section className="ds-group">
      <button type="button" className="ds-group-head" aria-expanded={!closed.price} onClick={() => setClosed((c) => ({ ...c, price: !c.price }))}>
        <span>Price</span>
        <ChevronDown size={18} className={closed.price ? "" : "is-open"} aria-hidden="true" />
      </button>
      {!closed.price && <PriceRange bounds={bounds} value={price} onChange={changePrice} />}
    </section>
  );

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
          {activeFilters > 0 && <button type="button" className="ds-link" onClick={clearAll}>Clear all</button>}
          <button type="button" className="ds-icon-btn ds-filters-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={18} /></button>
        </div>
        {facets.map((g, i) => {
          const picked = filters[g.id] || [];
          const many = g.options.length > SHOW_FIRST && !expanded[g.id];
          const visible = many ? g.options.filter((o, k) => k < SHOW_FIRST || picked.includes(o.v)) : g.options;
          return (
            <React.Fragment key={g.id}>
              {i === priceAt && priceGroup}
              <section className="ds-group">
                <button type="button" className="ds-group-head" aria-expanded={!closed[g.id]} onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))}>
                  <span>{g.title}{picked.length > 0 && <span className="ds-group-count">{picked.length}</span>}</span>
                  <ChevronDown size={18} className={closed[g.id] ? "" : "is-open"} aria-hidden="true" />
                </button>
                {!closed[g.id] && (
                  <div className="ds-options" role="group" aria-label={g.title}>
                    {visible.map((o) => (
                      <label key={o.v} className={`ds-check${o.n === 0 && !picked.includes(o.v) ? " is-empty" : ""}`}>
                        <input type="checkbox" checked={picked.includes(o.v)} onChange={() => toggle(g.id, o.v)} />
                        <span>{o.label} <em>({o.n})</em></span>
                      </label>
                    ))}
                    {g.options.length > SHOW_FIRST && (
                      <button type="button" className="ds-link" onClick={() => setExpanded((x) => ({ ...x, [g.id]: !x[g.id] }))}>
                        {many ? `Show ${g.options.length - visible.length} more` : "Show less"}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </React.Fragment>
          );
        })}
        {facets.length <= priceAt && priceGroup}
      </aside>

      <div className="ds-main">
        <div className="ds-pills" role="group" aria-label="Category">
          {Object.entries(categories || {}).map(([id, label]) => (
            <button key={id} type="button" className={`ds-pill${filters.purpose?.includes(id) ? " is-active" : ""}`} aria-pressed={Boolean(filters.purpose?.includes(id))}
              onClick={() => toggle("purpose", id)}>
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

        {chips.length > 0 && (
          <div className="ds-chips" aria-label="Selected filters">
            {chips.map((c) => (
              <button key={c.key} type="button" className="ds-chip" onClick={c.remove} aria-label={`Remove filter ${c.label}`}>
                {c.label} <X size={14} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="ds-link" onClick={clearAll}>Clear all</button>
          </div>
        )}

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
          <div className="ds-empty">
            <p>No servers match. Try fewer filters or another search.</p>
            {activeFilters > 0 && <button type="button" className="ds-btn ds-btn-ghost" onClick={clearAll}>Clear all filters</button>}
          </div>
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
