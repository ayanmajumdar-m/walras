import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, ArrowRight, MapPin, Eye, EyeOff, KeyRound, BadgePercent } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import { PRODUCTS, productStatus } from "./products";
import { CPU_TYPES, formatINR, formatRam, formatBandwidth } from "../../../data/plans";

/*
  One page to create anything, CloudPe style: pick the product at the top,
  configure it in the middle, review and pay in the summary on the right.
*/

// ── Virtual Machine ────────────────────────────────────────────────────────
const HOSTNAME_RE = /^(?=.{1,100}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const passwordOk = (p) => p.length >= 10 && p.length <= 72 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && !/\s/.test(p);

// 16 characters from the browser's CSPRNG, always with upper, lower and a digit.
const generatePassword = () => {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#%^*-_=+"];
  const all = sets.join("");
  const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const chars = [...sets.map((s) => s[rand(s.length)]), ...Array.from({ length: 12 }, () => all[rand(all.length)])];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

// Prepaid: buying charges the rest of this month, pro rata per day, counting
// today (India time), e.g. the 5th of a 30-day month = 26 of 30 days. The
// server charges the same (utils/monthlyBilling.js) and adds GST.
const proRataNow = (monthly) => {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  const dim = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
  const days = dim - ist.getUTCDate() + 1;
  return { days, dim, amount: Math.round((monthly * 100 * days) / dim) / 100 };
};

// Billing terms (also sent by /api/servers/catalog): 1 = monthly; the rest
// reserve the server from today for that many months, paid up front.
const DEFAULT_TERMS = [
  { months: 1, savings: 0 }, { months: 3, savings: 0 }, { months: 6, savings: 5 },
  { months: 12, savings: 10 }, { months: 24, savings: 15 }, { months: 36, savings: 25 },
];
const termLabel = (m) => (m === 1 ? "Monthly" : `${m} months`);

/** A reservation from today: total before GST, its savings, and the last reserved day. */
const reservationQuote = (monthly, { months, savings }) => {
  const gross = monthly * months;
  const saved = Math.round(gross * savings) / 100;
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth() + months;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(y, m, Math.min(ist.getUTCDate(), dim)) - 24 * 3600 * 1000);
  return { amount: Math.round((gross - saved) * 100) / 100, saved, until: end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) };
};

// mode "monthly" (Virtual Machine) or "reserved" (Reserved VM): the same
// plans, locations and stock; only the billing step differs.
const ComputeConfigurator = ({ mode = "monthly" }) => {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const reserveMode = mode === "reserved";
  const { balance, refreshBalance } = useConsole();
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [locationId, setLocationId] = useState(null);
  const [cpu, setCpu] = useState(CPU_TYPES[0].id);
  const [selected, setSelected] = useState(null);
  const [osId, setOsId] = useState("");
  const [hostname, setHostname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [termMonths, setTermMonths] = useState(reserveMode ? 12 : 1);

  useEffect(() => {
    api("/api/servers/catalog")
      .then((c) => {
        setCatalog(c);
        // Start on a location with stock, and a plan in stock there.
        // Prefer a location with stock; never one no SolusVM account serves yet.
        const loc = c.locations.find((l) => !l.comingSoon && c.plans.some((p) => p.locations.includes(l.id))) || c.locations.find((l) => !l.comingSoon);
        if (loc) {
          setLocationId(loc.id);
          const pick = c.plans.find((p) => p.popular && p.locations.includes(loc.id)) || c.plans.find((p) => p.locations.includes(loc.id));
          if (pick) { setSelected(pick.name); setCpu(pick.cpu || "intel"); }
        }
        if (c.os[0]) setOsId(String((c.os.find((o) => /ubuntu/i.test(o.name)) || c.os[0]).id));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const plans = catalog?.plans || [];
  // Plans for the chosen CPU type. None yet for a type = "coming soon", no plan.
  const cpuPlans = plans.filter((p) => (p.cpu || "intel") === cpu);
  const plan = cpuPlans.find((p) => p.name === selected) || cpuPlans[0] || null;
  const inStock = (p) => Boolean(catalog && locationId != null && (p.locations || []).includes(locationId));
  const anyStock = Boolean(catalog?.enabled);
  const hasLocations = catalog?.locations.length > 0;
  const hostnameOk = HOSTNAME_RE.test(hostname.trim());
  const canDeploy = plan && inStock(plan) && osId && hostnameOk && passwordOk(password) && !deploying;
  const allTerms = catalog?.terms?.length ? catalog.terms : DEFAULT_TERMS;
  const terms = allTerms.filter((t) => (reserveMode ? t.months > 1 : t.months === 1));
  const maxSavings = Math.max(...allTerms.map((t) => t.savings));
  const term = terms.find((t) => t.months === termMonths) || terms[0];
  const reserved = term.months > 1;
  const due = !plan ? { days: 0, dim: 0, amount: 0 }
    : reserved ? reservationQuote(plan.monthly, term) : proRataNow(plan.monthly);

  const pickLocation = (id) => {
    setLocationId(id);
    if (!plan || !(plan.locations || []).includes(id)) {
      const next = cpuPlans.find((p) => (p.locations || []).includes(id));
      if (next) setSelected(next.name);
    }
  };

  // Switching CPU type: keep the choice if it fits, else the first plan in stock.
  const pickCpu = (id) => {
    setCpu(id);
    const list = plans.filter((p) => (p.cpu || "intel") === id);
    const next = list.find((p) => inStock(p)) || list[0];
    if (next) setSelected(next.name);
  };

  const deploy = async () => {
    setError("");
    setDeploying(true);
    try {
      await api("/api/servers/deploy", {
        method: "POST",
        // OS choices are identified by name ("Ubuntu 22.04"): each SolusVM panel numbers its images differently.
        body: { plan: plan.name, location: locationId, os: osId, hostname: hostname.trim().toLowerCase(), password, term: term.months },
      });
      refreshBalance();
      navigate("/dashboard/resources?tab=servers&created=1");
    } catch (err) {
      if (err.message !== "Session expired") setError(err.message);
      setDeploying(false);
    }
  };

  return (
    <div className="cx-create-body">
      <div className="cx-config">
        {loadError && <div className="cx-alert is-error">{loadError}</div>}
        {catalog && !anyStock && (
          <div className="cx-alert is-info">
            Capacity is Full
          </div>
        )}
        {reserveMode && (
          <div className="cx-reserve-intro">
            <BadgePercent size={22} aria-hidden="true" />
            <div>
              <strong>Reserve a server and save up to {maxSavings}%</strong>
              <span>Commit to a server for 3 to 36 months from today and pay up front. It renews for the same term unless you cancel.</span>
            </div>
          </div>
        )}

        {hasLocations && (
          <section className="cx-card cx-step">
            <h3><span className="cx-step-num">1</span> Location</h3>
            <div className="cx-choice-grid">
              {catalog.locations.map((l) => {
                // No SolusVM account serves this location yet (Admin → SolusVM accounts).
                const soon = Boolean(l.comingSoon);
                const hasStock = !soon && catalog.plans.some((p) => p.locations.includes(l.id));
                const selected = !soon && locationId === l.id;
                return (
                  <label key={l.id} className={`cx-term${selected ? " is-selected" : ""}${hasStock ? "" : " is-muted"}${soon ? " is-soon" : ""}`}>
                    <input type="radio" name="compute-location" className="cx-visually-hidden" checked={selected} disabled={soon} onChange={() => pickLocation(l.id)} />
                    {!l.flagUrl && <MapPin size={18} aria-hidden="true" />}
                    <span>
                      {l.flagUrl && <img src={l.flagUrl} alt="" className="cx-flag" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                      <strong>{l.name}</strong>
                      <small>{l.country ? `${l.country} · ` : ""}{soon ? "Coming soon" : hasStock ? "Available" : "Out of stock"}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        <section className="cx-card cx-step">
          <h3><span className="cx-step-num">{hasLocations ? 2 : 1}</span> Choose a plan</h3>
          <div className="cx-family-head">
            <h4 className="cx-plan-family">General Purpose</h4>
            <div className="cx-seg" role="tablist" aria-label="CPU type">
              <span className="cx-seg-label">CPU type</span>
              {CPU_TYPES.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={cpu === c.id}
                  className={cpu === c.id ? "is-active" : ""} onClick={() => pickCpu(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {!catalog ? (
            <div className="cx-soon-inline"><span>{loadError ? "Plans couldn't be loaded." : "Loading plans…"}</span></div>
          ) : cpuPlans.length === 0 ? (
            <div className="cx-soon-inline">
              <strong>{CPU_TYPES.find((c) => c.id === cpu)?.label} plans are coming soon.</strong>
              <span>Choose another CPU type to see the plans available now.</span>
            </div>
          ) : (<>
          {/* Wide screens: a comparison table. Phones: one card per plan (below). */}
          <div className="cx-table-wrap cx-plan-table">
            <table className="cx-table cx-table-select">
              <thead>
                <tr><th /><th>Plan</th><th>vCPUs</th><th>Memory</th><th>NVMe SSD</th><th>Bandwidth</th><th>Price</th></tr>
              </thead>
              <tbody>
                {cpuPlans.map((p) => {
                  const available = inStock(p);
                  return (
                    <tr key={p.name} className={`${p.name === plan.name && available ? "is-selected" : ""}${available ? "" : " is-off"}`}
                      onClick={() => available && setSelected(p.name)}>
                      <td><input type="radio" name="compute-plan" checked={p.name === plan.name && available} disabled={!available} onChange={() => setSelected(p.name)} aria-label={p.name} /></td>
                      <td>
                        <strong>{p.name}</strong>
                        {!available ? <span className="cx-tag is-off">Out of stock</span> : p.popular && <span className="cx-tag">Popular</span>}
                      </td>
                      <td>{p.vcpu}</td>
                      <td>{formatRam(p.ram)}</td>
                      <td>{p.storage} GB</td>
                      <td>{formatBandwidth(p.bandwidth)}</td>
                      <td><strong>{formatINR(p.monthly)}</strong><small>/mo</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="cx-plan-cards" role="radiogroup" aria-label="Plan">
            {cpuPlans.map((p) => {
              const available = inStock(p);
              const selected = p.name === plan.name && available;
              return (
                <label key={p.name} className={`cx-plan-card${selected ? " is-selected" : ""}${available ? "" : " is-off"}`}>
                  <input type="radio" name="compute-plan-card" checked={selected} disabled={!available} onChange={() => setSelected(p.name)} />
                  <span className="cx-plan-card-main">
                    <span className="cx-plan-card-name">
                      <strong>{p.name}</strong>
                      {!available ? <span className="cx-tag is-off">Out of stock</span> : p.popular && <span className="cx-tag">Popular</span>}
                    </span>
                    <small>{p.vcpu} vCPU · {formatRam(p.ram)} RAM · {p.storage} GB NVMe SSD · {formatBandwidth(p.bandwidth)} bandwidth</small>
                  </span>
                  <span className="cx-plan-card-price">
                    <strong>{formatINR(p.monthly)}</strong><small>/mo</small>
                  </span>
                </label>
              );
            })}
          </div>
          </>)}
          <p className="cx-step-help">Every plan includes one IPv4 address and a 1 Gbps network port.</p>
        </section>

        {/* Shown even when out of stock, so prices and savings can be compared. */}
        {catalog && (
          <section className="cx-card cx-step">
            <h3><span className="cx-step-num">{hasLocations ? 3 : 2}</span> {reserveMode ? "Reservation term" : "Billing"}</h3>
            <div className="cx-choice-grid cx-term-grid" role="radiogroup" aria-label="Billing">
              {terms.map((t) => {
                const q = plan ? (t.months === 1 ? proRataNow(plan.monthly) : reservationQuote(plan.monthly, t)) : null;
                const on = t.months === term.months;
                return (
                  <label key={t.months} className={`cx-term${on ? " is-selected" : ""}`}>
                    <input type="radio" name="compute-term" className="cx-visually-hidden" checked={on} onChange={() => setTermMonths(t.months)} />
                    <span>
                      <strong>{termLabel(t.months)}{t.savings > 0 && <span className="cx-save">Save {t.savings}%*</span>}</strong>
                      <small>
                        {t.months === 1 ? "Pay the rest of this month now, then monthly on the 1st"
                          : q ? `${formatINR(q.amount, 2)} up front · ${formatINR(q.amount / t.months, 2)}/mo` : "Reserved, paid up front"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="cx-step-help cx-term-help">
              {reserved
                ? `Reserved for ${term.months} months from today${plan ? `, until ${due.until}` : ""}. Paid up front, renews automatically for another ${term.months} months unless you cancel; not refunded if cancelled early.`
                : "Cancel anytime; it ends at the end of the month you've paid for."}
            </p>
            {!reserveMode && maxSavings > 0 && (
              <button type="button" className="cx-reserve-nudge" onClick={() => setParams({ type: "reserved" }, { replace: true })}>
                <BadgePercent size={18} aria-hidden="true" />
                <span><strong>Keeping it 6 months or more?</strong> Reserve it instead and save up to {maxSavings}%.</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </section>
        )}

        {anyStock && (
          <section className="cx-card cx-step">
            <h3><span className="cx-step-num">{hasLocations ? 4 : 3}</span> Operating system and access</h3>
            <div className="cx-form-grid">
              <label className="cx-field">
                <span>Operating system</span>
                <select value={osId} onChange={(e) => setOsId(e.target.value)}>
                  {catalog.os.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              <label className="cx-field">
                <span>Hostname</span>
                <input type="text" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="web1.mybusiness.com"
                  autoComplete="off" spellCheck="false" maxLength={100} />
                {hostname && !hostnameOk && <small className="cx-field-error">Letters, numbers, hyphens and dots only, e.g. web1 or app.example.com</small>}
              </label>
              <div className="cx-field cx-field-wide">
                <label htmlFor="compute-password">Root password</label>
                <span className="cx-input-row">
                  <input id="compute-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password" spellCheck="false" maxLength={72} />
                  <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />} {showPassword ? "Hide" : "Show"}
                  </button>
                  <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }}>
                    <KeyRound size={14} /> Generate
                  </button>
                </span>
                <small className={password && !passwordOk(password) ? "cx-field-error" : "cx-field-hint"}>
                  10 to 72 characters with upper and lower case letters and a number. We don't store it, so keep a copy.
                </small>
              </div>
            </div>
          </section>
        )}
      </div>

      <aside className="cx-summary">
        <div className="cx-card cx-summary-card">
          <h3>Order summary</h3>
          <dl>
            <div><dt>Product</dt><dd>{reserveMode ? "Reserved VM" : "Virtual Machine"}</dd></div>
            <div><dt>Type</dt><dd>General Purpose · {CPU_TYPES.find((c) => c.id === cpu)?.label}</dd></div>
            <div><dt>Plan</dt><dd>{plan ? plan.name : "—"}</dd></div>
            {plan && <div><dt>Resources</dt><dd>{plan.vcpu} vCPU · {formatRam(plan.ram)}</dd></div>}
            {hasLocations && <div><dt>Location</dt><dd>{catalog.locations.find((l) => l.id === locationId)?.name || "—"}</dd></div>}
          </dl>
          <dl className="cx-summary-money">
            <div><dt>Monthly</dt><dd>{plan ? formatINR(plan.monthly) : "—"}</dd></div>
            <div><dt>Billing</dt><dd>{reserved ? `${term.months}-month reservation` : "Monthly"}</dd></div>
            {plan && reserved && due.saved > 0 && <div className="cx-summary-save"><dt>Savings*</dt><dd>−{formatINR(due.saved, 2)}</dd></div>}
            {plan && (
              <div className="cx-summary-total">
                <dt>Due now <small>{reserved ? `(until ${due.until})` : `(${due.days} of ${due.dim} days)`}</small></dt>
                <dd>{formatINR(due.amount, 2)}</dd>
              </div>
            )}
          </dl>
          {plan && inStock(plan) && balance < due.amount && (
            <p className="cx-alert is-info">
              Your balance is {formatINR(balance, 2)}. <Link to="/dashboard/billing" className="cx-link">Add funds</Link> to create this server.
            </p>
          )}
          {error && (
            <p className="cx-alert is-error" role="alert">
              {error}{/balance is too low/i.test(error) && <> <Link to="/dashboard/billing" className="cx-link">Add funds</Link></>}
            </p>
          )}
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block cx-btn-lg" onClick={deploy} disabled={!canDeploy}>
            {deploying ? <><Loader2 size={18} className="cx-spin" /> Creating server…</>
              : !plan ? "Coming soon" : inStock(plan) ? "Deploy server" : "Out of stock"}
          </button>
          <p className="cx-summary-note">
            {reserved
              ? <>Paid from your account balance ({formatINR(balance, 2)}) for the whole reservation now. Prices exclude GST.<br />*Savings compared with paying monthly for the same period.</>
              : <>Paid from your account balance ({formatINR(balance, 2)}): the rest of this month now, pro rata, then the full month on the 1st of each month. Prices exclude GST.</>}
          </p>
        </div>
      </aside>
    </div>
  );
};

// ── Coming soon ────────────────────────────────────────────────────────────
const COMING_SOON = {
  domains: {
    title: "Domains are coming soon",
    points: ["Free lifetime WHOIS privacy on every domain", "Registry lock against unauthorised transfers", "DNS management from this console"],
  },
  baremetal: {
    title: "Bare Metal is coming soon",
    points: ["Single-tenant hardware: the entire server is yours", "Dedicated CPU cores, memory and storage", "Full root access to the machine"],
  },
};

const ComingSoon = ({ type }) => {
  const info = COMING_SOON[type];
  return (
    <div className="cx-card cx-soon">
      <span className="cx-pill">Coming soon</span>
      <h3>{info.title}</h3>
      <ul className="cx-checklist">
        {info.points.map((p) => <li key={p}><ShieldCheck size={18} aria-hidden="true" />{p}</li>)}
      </ul>
      <a href="/contact" className="cx-btn cx-btn-ghost">Get notified when it launches <ArrowRight size={15} /></a>
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────
const Create = () => {
  const { platform } = useConsole();
  const [params, setParams] = useSearchParams();
  const type = PRODUCTS.some((p) => p.id === params.get("type")) ? params.get("type") : PRODUCTS[0].id;

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Create a resource</h2>
        <p>Pick a product, configure it and pay. It's ready in minutes.</p>
      </div>

      <div className="cx-product-tabs" role="tablist" aria-label="Product">
        {PRODUCTS.map((product) => {
          const { id, Icon, title } = product;
          const { label, available } = productStatus(product, platform);
          return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={type === id}
            className={`cx-product-tab${type === id ? " is-active" : ""}`}
            onClick={() => setParams({ type: id }, { replace: true })}
          >
            <Icon size={20} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small className={available ? "is-brand" : ""}>{label}</small>
            </span>
          </button>
          );
        })}
      </div>

      {type === "compute" && <ComputeConfigurator key="monthly" mode="monthly" />}
      {type === "reserved" && <ComputeConfigurator key="reserved" mode="reserved" />}
      {(type === "domains" || type === "baremetal") && <ComingSoon type={type} />}
    </div>
  );
};

export default Create;
