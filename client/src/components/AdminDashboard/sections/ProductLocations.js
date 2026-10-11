import React, { useCallback, useEffect, useState } from "react";
import { MapPin, Save } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Which locations a product is offered in: Managed Database ("database") or
  App Platform ("apps"). Both start with Mumbai only. Customers see only these
  locations (if they're also active in Admin → Locations).
*/
const ProductLocations = ({ product, label, editable, onSaved }) => {
  const [locations, setLocations] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi(`/product-locations/${product}`)
      .then((d) => { setLocations(d.locations); setPicked(new Set(d.locations.filter((l) => l.offered).map((l) => l.id))); })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, [product]);
  useEffect(load, [load]);

  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const changed = locations && locations.some((l) => l.offered !== picked.has(l.id));

  const save = async () => {
    setBusy(true);
    try {
      const d = await adminApi(`/product-locations/${product}`, { method: "PUT", body: { locationIds: [...picked] } });
      setNotice({ type: "success", text: d.message });
      load();
      if (onSaved) onSaved();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cx-card ap-prodloc">
      <div className="ap-prodloc-head">
        <MapPin size={16} aria-hidden="true" />
        <strong>{label} is offered in</strong>
        {editable && changed && (
          <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={save} disabled={busy}><Save size={14} /> {busy ? "Saving…" : "Save locations"}</button>
        )}
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!locations ? <p className="ap-muted">Loading…</p> : (
        <div className="ap-prodloc-list">
          {locations.map((l) => (
            <label key={l.id} className={`ap-prodloc-item${picked.has(l.id) ? " is-on" : ""}`}>
              <input type="checkbox" checked={picked.has(l.id)} disabled={!editable} onChange={() => toggle(l.id)} />
              <span>{l.name}{l.country ? `, ${l.country}` : ""}{!l.active && <small className="ap-muted"> (hidden location)</small>}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProductLocations;
