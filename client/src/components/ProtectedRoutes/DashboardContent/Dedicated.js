import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Server, X, Clock, CheckCircle2 } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import DedicatedCatalog, { countryName, flagUrl, formatInr, formatTraffic, formatUplink, processorLine } from "../../Dedicated/DedicatedCatalog";
import { KycLocked, kycLocked } from "./Kyc";

/*
  Console → Dedicated Servers: the account's dedicated servers, then the
  catalog to order another. Ordering charges nothing and starts nothing
  yet: the server is recorded as bought and our team sets it up by hand,
  then marks it active (utils/dedicated.js). metal.walras.net's Order
  buttons land here with ?order=<id>.
*/

const STATUS = {
  pending: { label: "Bought · being set up", tone: "pending" },
  active: { label: "Active", tone: "active" },
  cancelled: { label: "Cancelled", tone: "stopped" },
};

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

const Confirm = ({ server, delivery, onClose, onOrdered }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const order = async () => {
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/dedicated/orders", { method: "POST", body: { serverId: server.id } });
      onOrdered(d.message);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal" role="dialog" aria-modal="true" aria-label="Order a dedicated server" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>Order {server.cpu}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <dl className="ds-confirm-specs">
          {(server.brand || server.model) && <div><dt>Hardware</dt><dd>{[server.brand, server.model].filter(Boolean).join(" ")}</dd></div>}
          <div><dt>Location</dt><dd>{server.location || countryName(server.countryCode)}</dd></div>
          <div><dt>Processor</dt><dd>{processorLine(server)}</dd></div>
          <div><dt>Memory</dt><dd>{server.memoryGb}GB</dd></div>
          <div><dt>Storage</dt><dd>{server.storage}</dd></div>
          <div><dt>Network</dt><dd>{server.network} · {formatUplink(server.uplinkGbps)} · {formatTraffic(server.trafficTb)}</dd></div>
          <div><dt>Delivery</dt><dd>{delivery[server.delivery] || server.delivery}</dd></div>
          <div><dt>Price</dt><dd><strong>{formatInr(server.monthly)}/month</strong> + GST</dd></div>
        </dl>
        <p className="ds-confirm-note">Nothing is charged now. Our team sets up your server and contacts you before it goes live.</p>
        {error && <div className="cx-alert is-error" role="alert">{error}</div>}
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={order} disabled={busy}>
          {busy ? "Ordering…" : "Order this server"}
        </button>
      </div>
    </div>
  );
};

const Dedicated = () => {
  const { kyc } = useConsole();
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState(null);
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadOrders = useCallback(() => {
    api("/api/dedicated/orders").then((d) => setOrders(d.orders || [])).catch(() => setOrders([]));
  }, []);
  const loadCatalog = useCallback(() => {
    fetch("/api/dedicated/catalog")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setCatalog)
      .catch(() => setError("Servers couldn't be loaded right now. Please refresh in a moment."));
  }, []);
  useEffect(() => { loadOrders(); loadCatalog(); }, [loadOrders, loadCatalog]);

  const locked = kycLocked(kyc, "dedicated");

  // Arriving from metal.walras.net with ?order=<id>: open that server's order form.
  const wanted = params.get("order");
  useEffect(() => {
    if (!wanted || !catalog || locked) return;
    const s = catalog.servers.find((x) => String(x.id) === wanted);
    if (s?.inStock) setPicked(s);
    else if (s) setNotice({ type: "error", text: `${s.cpu} is out of stock right now. Choose another server below.` });
    setParams({}, { replace: true });
  }, [wanted, catalog, locked, setParams]);

  const ordered = (text) => {
    setPicked(null);
    setNotice({ type: "success", text });
    loadOrders();
    loadCatalog();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const action = (s) => (s.inStock ? (
    <button type="button" className="ds-btn ds-btn-primary" onClick={() => setPicked(s)}>Order</button>
  ) : (
    <button type="button" className="ds-btn" disabled>Out of stock</button>
  ));

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Dedicated Servers</h2>
        <p>Single-tenant machines with dedicated cores, memory and storage, set up for you by our team.</p>
      </div>

      {notice && (
        <div className={`cx-alert is-${notice.type}`} role="status">
          {notice.text}
          <button type="button" className="cx-icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {orders && orders.length > 0 && (
        <section className="cx-section">
          <div className="cx-section-head"><h3>Your dedicated servers</h3><span className="cx-count">{orders.length}</span></div>
          <div className="cx-card cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Server</th><th>Location</th><th>Price</th><th>Status</th><th>Ordered</th></tr></thead>
              <tbody>
                {orders.map((o) => {
                  const st = STATUS[o.status] || STATUS.pending;
                  return (
                    <tr key={o.id}>
                      <td data-label="Server">
                        <strong>{o.spec.cpu || o.title}</strong>
                        <small>{o.spec.cores ? `${processorLine(o.spec)} · ${o.spec.memoryGb}GB · ${o.spec.storage}` : ""}</small>
                        {o.note && <small className="ds-order-note">From our team: {o.note}</small>}
                      </td>
                      <td data-label="Location">
                        <span className="ds-order-loc">
                          {o.spec.countryCode && <img src={flagUrl(o.spec.countryCode)} alt="" width="18" height="13" />}
                          {o.location}
                        </span>
                      </td>
                      <td data-label="Price">{formatInr(o.monthly)}/mo</td>
                      <td data-label="Status">
                        <span className={`cx-status is-${st.tone}`}>
                          {o.status === "active" ? <CheckCircle2 size={13} aria-hidden="true" /> : o.status === "pending" ? <Clock size={13} aria-hidden="true" /> : null} {st.label}
                        </span>
                      </td>
                      <td data-label="Ordered">{day(o.createdAt)}{o.activatedAt && o.status === "active" && <small>active since {day(o.activatedAt)}</small>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cx-section">
        <div className="cx-section-head"><h3><Server size={17} aria-hidden="true" /> Order a dedicated server</h3></div>
        {locked ? <KycLocked product="dedicated" /> : (
          <DedicatedCatalog servers={catalog?.servers} categories={catalog?.categories} delivery={catalog?.delivery}
            loading={!catalog && !error} error={error} action={action} />
        )}
      </section>

      {picked && <Confirm server={picked} delivery={catalog?.delivery || {}} onClose={() => setPicked(null)} onOrdered={ordered} />}
    </div>
  );
};

export default Dedicated;
