import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MapPin, Database, Layers } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import { DB_ENGINES, formatINR, formatRam, formatStorage, formatBackups } from "../../../data/plans";

/*
  Create → Managed Database: General Purpose, then location, engine (MySQL or
  PostgreSQL) and plan, then a name. Sold against stock per plan and location
  (Admin → Managed Database → Stock) and billed like a monthly VM: the rest of
  this month now, pro rata, then the full month on the 1st. Our team sets the
  database up; its connection details appear in Resources → Databases.
*/

// The rest of this month, pro rata per day, counting today (India time); the server charges the same.
const proRataNow = (monthly) => {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  const dim = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
  const days = dim - ist.getUTCDate() + 1;
  return { days, dim, amount: Math.round((monthly * 100 * days) / dim) / 100 };
};

const NAME_RE = /^[a-z][a-z0-9-]{1,38}[a-z0-9]$/;

const DatabaseConfigurator = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance } = useConsole();
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [locationId, setLocationId] = useState(null);
  const [engine, setEngine] = useState(DB_ENGINES[0].id);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/databases/catalog")
      .then((c) => {
        setCatalog(c);
        // Start on a location with stock, and the first plan in stock there.
        // Prefer a location with stock; never one that's coming soon.
        const loc = c.locations.find((l) => !l.comingSoon && c.plans.some((p) => p.locations.includes(l.id))) || c.locations.find((l) => !l.comingSoon);
        if (loc) {
          setLocationId(loc.id);
          const pick = c.plans.find((p) => p.locations.includes(loc.id));
          if (pick) setSelected(pick.name);
        }
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const plans = catalog?.plans || [];
  const engines = catalog?.engines?.length ? catalog.engines : DB_ENGINES;
  const inStock = (p) => Boolean(locationId != null && (p.locations || []).includes(locationId));
  const plan = plans.find((p) => p.name === selected && inStock(p)) || plans.find((p) => inStock(p)) || null;
  const hasLocations = catalog?.locations.length > 0;
  const nameOk = NAME_RE.test(name.trim());
  const due = plan ? proRataNow(plan.monthly) : { days: 0, dim: 0, amount: 0 };
  const canOrder = plan && nameOk && !busy;

  const pickLocation = (id) => {
    setLocationId(id);
    if (!plan || !(plan.locations || []).includes(id)) {
      const next = plans.find((p) => (p.locations || []).includes(id));
      if (next) setSelected(next.name);
    }
  };

  const order = async () => {
    setError("");
    setBusy(true);
    try {
      await api("/api/databases", { method: "POST", body: { plan: plan.name, location: locationId, engine, name: name.trim().toLowerCase() } });
      refreshBalance();
      navigate("/dashboard/resources?tab=databases&created=1");
    } catch (err) {
      if (err.message !== "Session expired") setError(err.message);
      setBusy(false);
    }
  };

  const step = (n) => <span className="cx-step-num">{n}</span>;

  return (
    <div className="cx-create-body">
      <div className="cx-config">
        {loadError && <div className="cx-alert is-error">{loadError}</div>}
        {catalog && !catalog.enabled && <div className="cx-alert is-info">Capacity is Full, New capacity is on its way.</div>}

        <section className="cx-card cx-step">
          <h3>{step(1)} Type</h3>
          <div className="cx-choice-grid">
            <label className="cx-term is-selected">
              <input type="radio" name="db-family" className="cx-visually-hidden" checked readOnly />
              <Layers size={18} aria-hidden="true" />
              <span><strong>General Purpose</strong><small>Balanced CPU and memory for apps and websites</small></span>
            </label>
          </div>
        </section>

        {hasLocations && (
          <section className="cx-card cx-step">
            <h3>{step(2)} Location</h3>
            <div className="cx-choice-grid">
              {catalog.locations.map((l) => {
                // Like Virtual Machines: a location Managed Database isn't offered in yet is "coming soon".
                const soon = Boolean(l.comingSoon);
                const hasStock = !soon && plans.some((p) => p.locations.includes(l.id));
                const on = !soon && locationId === l.id;
                return (
                  <label key={l.id} className={`cx-term${on ? " is-selected" : ""}${hasStock ? "" : " is-muted"}${soon ? " is-soon" : ""}`}>
                    <input type="radio" name="db-location" className="cx-visually-hidden" checked={on} disabled={soon} onChange={() => pickLocation(l.id)} />
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
          <h3>{step(hasLocations ? 3 : 2)} Database engine</h3>
          <div className="cx-choice-grid">
            {engines.map((e) => (
              <label key={e.id} className={`cx-term${engine === e.id ? " is-selected" : ""}`}>
                <input type="radio" name="db-engine" className="cx-visually-hidden" checked={engine === e.id} onChange={() => setEngine(e.id)} />
                <Database size={18} aria-hidden="true" />
                <span><strong>{e.label}</strong><small>{e.id === "mysql" ? "The popular choice for web apps" : "Advanced SQL and extensions"}</small></span>
              </label>
            ))}
          </div>
        </section>

        <section className="cx-card cx-step">
          <h3>{step(hasLocations ? 4 : 3)} Choose a plan</h3>
          <div className="cx-family-head"><h4 className="cx-plan-family">General Purpose</h4></div>
          {!catalog ? (
            <div className="cx-soon-inline"><span>{loadError ? "Plans couldn't be loaded." : "Loading plans…"}</span></div>
          ) : plans.length === 0 ? (
            <div className="cx-soon-inline"><strong>Managed Database plans are coming soon.</strong></div>
          ) : (<>
            <div className="cx-table-wrap cx-plan-table">
              <table className="cx-table cx-table-select">
                <thead><tr><th /><th>Plan</th><th>vCPU</th><th>Memory</th><th>Storage</th><th>Backups</th><th>Price</th></tr></thead>
                <tbody>
                  {plans.map((p) => {
                    const available = inStock(p);
                    const on = plan && p.name === plan.name;
                    return (
                      <tr key={p.name} className={`${on ? "is-selected" : ""}${available ? "" : " is-off"}`} onClick={() => available && setSelected(p.name)}>
                        <td><input type="radio" name="db-plan" checked={Boolean(on)} disabled={!available} onChange={() => setSelected(p.name)} aria-label={p.name} /></td>
                        <td><strong>{p.name}</strong>{!available && <span className="cx-tag is-off">Out of stock</span>}</td>
                        <td>{p.vcpu}</td>
                        <td>{formatRam(p.ram)}</td>
                        <td>{formatStorage(p.storage)}</td>
                        <td>{formatBackups(p.backupDays)}</td>
                        <td><strong>{formatINR(p.monthly)}</strong><small>/mo</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="cx-plan-cards" role="radiogroup" aria-label="Plan">
              {plans.map((p) => {
                const available = inStock(p);
                const on = Boolean(plan && p.name === plan.name);
                return (
                  <label key={p.name} className={`cx-plan-card${on ? " is-selected" : ""}${available ? "" : " is-off"}`}>
                    <input type="radio" name="db-plan-card" checked={on} disabled={!available} onChange={() => setSelected(p.name)} />
                    <span className="cx-plan-card-main">
                      <span className="cx-plan-card-name"><strong>{p.name}</strong>{!available && <span className="cx-tag is-off">Out of stock</span>}</span>
                      <small>{p.vcpu} vCPU · {formatRam(p.ram)} RAM · {formatStorage(p.storage)} storage · backups {formatBackups(p.backupDays).toLowerCase()}</small>
                    </span>
                    <span className="cx-plan-card-price"><strong>{formatINR(p.monthly)}</strong><small>/mo</small></span>
                  </label>
                );
              })}
            </div>
          </>)}
          <p className="cx-step-help">Daily backups are included. Billed monthly: cancel anytime, it ends at the end of the month you've paid for.</p>
        </section>

        {catalog?.enabled && (
          <section className="cx-card cx-step">
            <h3>{step(hasLocations ? 5 : 4)} Name</h3>
            <div className="cx-form-grid">
              <label className="cx-field">
                <span>Database name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="app-db" autoComplete="off" spellCheck="false" maxLength={40} />
                {name && !nameOk
                  ? <small className="cx-field-error">3 to 40 lowercase letters, numbers or hyphens, starting with a letter.</small>
                  : <small className="cx-field-hint">For you to recognise it in the console.</small>}
              </label>
            </div>
          </section>
        )}
      </div>

      <aside className="cx-summary">
        <div className="cx-card cx-summary-card">
          <h3>Order summary</h3>
          <dl>
            <div><dt>Product</dt><dd>Managed Database</dd></div>
            <div><dt>Type</dt><dd>General Purpose</dd></div>
            <div><dt>Engine</dt><dd>{engines.find((e) => e.id === engine)?.label}</dd></div>
            <div><dt>Plan</dt><dd>{plan ? plan.name : "—"}</dd></div>
            {plan && <div><dt>Resources</dt><dd>{plan.vcpu} vCPU · {formatRam(plan.ram)} · {formatStorage(plan.storage)}</dd></div>}
            {hasLocations && <div><dt>Location</dt><dd>{catalog.locations.find((l) => l.id === locationId)?.name || "—"}</dd></div>}
          </dl>
          <dl className="cx-summary-money">
            <div><dt>Monthly</dt><dd>{plan ? formatINR(plan.monthly) : "—"}</dd></div>
            {plan && (
              <div className="cx-summary-total">
                <dt>Due now <small>({due.days} of {due.dim} days)</small></dt>
                <dd>{formatINR(due.amount, 2)}</dd>
              </div>
            )}
          </dl>
          {plan && balance < due.amount && (
            <p className="cx-alert is-info">
              Your balance is {formatINR(balance, 2)}. <Link to="/dashboard/billing" className="cx-link">Add funds</Link> to create this database.
            </p>
          )}
          {error && (
            <p className="cx-alert is-error" role="alert">
              {error}{/balance is too low/i.test(error) && <> <Link to="/dashboard/billing" className="cx-link">Add funds</Link></>}
            </p>
          )}
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block cx-btn-lg" onClick={order} disabled={!canOrder}>
            {busy ? <><Loader2 size={18} className="cx-spin" /> Ordering…</> : !catalog?.enabled ? "Out of stock" : "Create database"}
          </button>
          <p className="cx-summary-note">
            Paid from your account balance ({formatINR(balance, 2)}): the rest of this month now, pro rata, then the full month on the 1st. Prices exclude GST.
            We set the database up for you; its connection details appear in Resources → Databases.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default DatabaseConfigurator;
