import React from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet as WalletIcon, Activity, FileText } from "lucide-react";
import Wallet from "./Wallet";
import Logs from "./Logs";
import Invoices from "./Invoices";

/*
  Account Balance (balance, add funds, promo codes), Invoices and Usage under
  one page. The tab is ?tab= in the URL, so links (the unpaid-invoice banner,
  payment returns) can open a tab even while Billing is already showing.
  Other parameters (?payment_status=… from payment gateways) are kept for
  the tab that reads them.
*/
const TABS = [
  { id: "wallet", label: "Account Balance", Icon: WalletIcon },
  { id: "invoices", label: "Invoices", Icon: FileText },
  { id: "usage", label: "Usage & activity", Icon: Activity },
];

const Billing = ({ initialTab }) => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : initialTab || "wallet";
  const setTab = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set("tab", id); return next; }, { replace: true });

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Billing</h2>
        <p>Your account balance, monthly invoices and usage.</p>
      </div>

      <div className="cx-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`cx-tab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === "invoices" ? <Invoices /> : tab === "usage" ? <Logs /> : (
        <div className="cx-legacy">
          <Wallet />
        </div>
      )}
    </div>
  );
};

export default Billing;
