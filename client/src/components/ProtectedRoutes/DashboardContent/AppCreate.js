import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Rocket, Server, Globe } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import { APP_TYPES, formatINR, formatRam, formatBandwidth } from "../../../data/plans";

/*
  Create → App Platform: pick the type (Shared; Dedicated is coming soon) and
  a plan, choose the domain, pay, and the app is active. Billed like a
  monthly VM: the rest of this month now, pro rata, then the full month on
  the 1st (utils/monthlyBilling.js).
*/

const proRataNow = (monthly) => {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  const dim = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
  const days = dim - ist.getUTCDate() + 1;
  return { days, dim, amount: Math.round((monthly * 100 * days) / dim) / 100 };
};

const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const cleanDomain = (d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");

const AppConfigurator = () => {
  const navigate = useNavigate();
  const { balance, refreshBalance } = useConsole();
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/apps/catalog")
      .then((c) => { setCatalog(c); if (c.plans[0]) setSelected(c.plans[0].name); })
      .catch((e) => setLoadError(e.message));
  }, []);

  const types = catalog?.types?.length ? catalog.types : APP_TYPES;
  const plans = (catalog?.plans || []).filter((p) => p.type === "shared");
  const plan = plans.find((p) => p.name === selected) || plans[0] || null;
  const host = cleanDomain(domain);
  const domainOk = DOMAIN_RE.test(host);
  const due = plan ? proRataNow(plan.monthly) : { days: 0, dim: 0, amount: 0 };

  const deploy = async () => {
    setError("");
    setBusy(true);
    try {
      await api("/api/apps", { method: "POST", body: { plan: plan.name, domain: host } });
      refreshBalance();
      navigate("/dashboard/resources?tab=apps&created=1");
    } catch (err) {
      if (err.message !== "Session expired") setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-create-body">
      <div className="cx-config">
        {loadError && <div className="cx-alert is-error">{loadError}</div>}

        <section className="cx-card cx-step">
          <h3><span className="cx-step-num">1</span> Type</h3>
          <div className="cx-choice-grid">
            {types.map((t) => (
              <label key={t.id} className={`cx-term${t.id === "shared" ? " is-selected" : ""}${t.available ? "" : " is-muted is-soon"}`}>
                <input type="radio" name="app-type" className="cx-visually-hidden" checked={t.id === "shared"} disabled={!t.available} readOnly />
                <Server size={18} aria-hidden="true" />
                <span>
                  <strong>{t.label}</strong>
                  <small>{t.available ? "Your app on shared resources, with a shared IP" : "Coming soon"}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="cx-card cx-step">
          <h3><span className="cx-step-num">2</span> Choose a plan</h3>
          <div className="cx-family-head"><h4 className="cx-plan-family">Shared</h4></div>
          {!catalog ? (
            <div className="cx-soon-inline"><span>{loadError ? "Plans couldn't be loaded." : "Loading plans…"}</span></div>
          ) : plans.length === 0 ? (
            <div className="cx-soon-inline"><strong>App Platform plans are coming soon.</strong></div>
          ) : (<>
            <div className="cx-table-wrap cx-plan-table">
              <table className="cx-table cx-table-select">
                <thead><tr><th /><th>Plan</th><th>vCPU</th><th>Memory</th><th>NVMe SSD</th><th>Bandwidth</th><th>IP</th><th>Price</th></tr></thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.name} className={p.name === plan.name ? "is-selected" : ""} onClick={() => setSelected(p.name)}>
                      <td><input type="radio" name="app-plan" checked={p.name === plan.name} onChange={() => setSelected(p.name)} aria-label={p.name} /></td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.vcpu}</td>
                      <td>{formatRam(p.ram)}</td>
                      <td>{p.storage} GB</td>
                      <td>{formatBandwidth(p.bandwidth)}</td>
                      <td>{p.dedicatedIp ? "Dedicated" : "Shared"}</td>
                      <td><strong>{formatINR(p.monthly)}</strong><small>/mo</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cx-plan-cards" role="radiogroup" aria-label="Plan">
              {plans.map((p) => (
                <label key={p.name} className={`cx-plan-card${p.name === plan.name ? " is-selected" : ""}`}>
                  <input type="radio" name="app-plan-card" checked={p.name === plan.name} onChange={() => setSelected(p.name)} />
                  <span className="cx-plan-card-main">
                    <span className="cx-plan-card-name"><strong>{p.name}</strong></span>
                    <small>{p.vcpu} vCPU · {formatRam(p.ram)} RAM · {p.storage} GB NVMe SSD · {formatBandwidth(p.bandwidth)} bandwidth · {p.dedicatedIp ? "dedicated" : "shared"} IP</small>
                  </span>
                  <span className="cx-plan-card-price"><strong>{formatINR(p.monthly)}</strong><small>/mo</small></span>
                </label>
              ))}
            </div>
          </>)}
        </section>

        <section className="cx-card cx-step">
          <h3><span className="cx-step-num">3</span> Choose domain</h3>
          <div className="cx-form-grid">
            <label className="cx-field">
              <span>Domain</span>
              <span className="cx-input-row">
                <Globe size={16} aria-hidden="true" />
                <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" autoComplete="off" spellCheck="false" maxLength={253} />
              </span>
              {domain && !domainOk
                ? <small className="cx-field-error">Enter a domain like example.com or app.example.com.</small>
                : <small className="cx-field-hint">The domain your app runs on. You'll point its DNS to us.</small>}
            </label>
          </div>
        </section>
      </div>

      <aside className="cx-summary">
        <div className="cx-card cx-summary-card">
          <h3>Order summary</h3>
          <dl>
            <div><dt>Product</dt><dd>App Platform</dd></div>
            <div><dt>Type</dt><dd>Shared</dd></div>
            <div><dt>Plan</dt><dd>{plan ? plan.name : "—"}</dd></div>
            {plan && <div><dt>Resources</dt><dd>{plan.vcpu} vCPU · {formatRam(plan.ram)} · {plan.storage} GB</dd></div>}
            <div><dt>Domain</dt><dd>{domainOk ? host : "—"}</dd></div>
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
              Your balance is {formatINR(balance, 2)}. <Link to="/dashboard/billing" className="cx-link">Add funds</Link> to deploy this app.
            </p>
          )}
          {error && (
            <p className="cx-alert is-error" role="alert">
              {error}{/balance is too low/i.test(error) && <> <Link to="/dashboard/billing" className="cx-link">Add funds</Link></>}
            </p>
          )}
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block cx-btn-lg" onClick={deploy} disabled={!plan || !domainOk || busy}>
            {busy ? <><Loader2 size={18} className="cx-spin" /> Deploying…</> : <><Rocket size={18} /> Pay and deploy</>}
          </button>
          <p className="cx-summary-note">
            Paid from your account balance ({formatINR(balance, 2)}): the rest of this month now, pro rata, then the full month on the 1st. Prices exclude GST.
            Your plan is active as soon as it's paid.
          </p>
        </div>
      </aside>
    </div>
  );
};

export default AppConfigurator;
