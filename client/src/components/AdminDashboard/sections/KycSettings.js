import React, { useEffect, useState } from "react";
import { FileCheck, Save } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Settings → KYC. The services ticked here can't be ordered until the
  customer's KYC is verified (Customers → the customer → KYC). Everything
  else stays open to them. See utils/kyc.js.
*/
const KycSettings = () => {
  const [products, setProducts] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi("/settings/kyc").then((d) => setProducts(d.products)).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const d = await adminApi("/settings/kyc", { method: "PUT", body: { required: products.filter((p) => p.required).map((p) => p.id) } });
      setProducts(d.products);
      setNotice({ type: "success", text: "KYC settings saved" });
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cx-card ap-card">
      <h3><FileCheck size={18} /> KYC</h3>
      <p className="ap-muted">
        Customers can't order the services ticked here until you mark their KYC verified. They send their documents
        from the console, which opens a KYC VERIFICATION ticket; verify or reject them on the customer's page.
      </p>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!products ? (
        !notice && <p className="ap-muted">Loading…</p>
      ) : (
        <>
          <div className="ap-kyc-products">
            {products.map((p) => (
              <label key={p.id} className="ap-check">
                <input type="checkbox" checked={p.required}
                  onChange={(e) => setProducts(products.map((x) => (x.id === p.id ? { ...x, required: e.target.checked } : x)))} />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          <p className="ap-muted">{products.some((p) => p.required) ? "Ticked services need KYC." : "Nothing needs KYC: every customer can order everything."}</p>
          <div className="ap-card-foot">
            <button type="button" className="cx-btn cx-btn-primary" disabled={busy} onClick={save}><Save size={15} /> Save KYC settings</button>
          </div>
        </>
      )}
    </section>
  );
};

export default KycSettings;
