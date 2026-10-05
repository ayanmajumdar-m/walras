import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wallet as WalletIcon, Activity } from "lucide-react";
import Wallet from "./Wallet";
import Logs from "./Logs";

/*
  Wallet (balance, add funds, promo codes) and Usage (billing activity) under
  one page. The tab lives in component state, not the URL, so the
  ?payment_status=… that payment gateways append to /dashboard/wallet is left
  for Wallet to read.
*/
const TABS = [
  { id: "wallet", label: "Wallet", Icon: WalletIcon },
  { id: "usage", label: "Usage & activity", Icon: Activity },
];

const Billing = ({ initialTab }) => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(initialTab || (params.get("tab") === "usage" ? "usage" : "wallet"));

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Billing</h2>
        <p>Your wallet balance, top-ups and usage.</p>
      </div>

      <div className="cx-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`cx-tab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="cx-legacy">
        {tab === "wallet" ? <Wallet /> : <Logs />}
      </div>
    </div>
  );
};

export default Billing;
