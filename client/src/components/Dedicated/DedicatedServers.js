import React, { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import DedicatedCatalog from "./DedicatedCatalog";
import { siteHref } from "../../data/site";
import "../About/Pricing.css";

/*
  Dedicated, the public catalog: metal.walras.net (and
  /dedicated on the main site). Ordering happens in the console on
  the main site, where the customer is signed in.
*/
const DedicatedServers = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Dedicated | Walras Cloud";
    fetch("/api/dedicated/catalog")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setData)
      .catch(() => setError("Servers couldn't be loaded right now. Please refresh in a moment."));
  }, []);

  const action = (s) => (s.inStock ? (
    <a className="ds-btn ds-btn-primary" href={siteHref(`/dashboard/dedicated?order=${s.id}`)}>
      Order <ArrowRight size={16} aria-hidden="true" />
    </a>
  ) : (
    <button type="button" className="ds-btn" disabled>Out of stock</button>
  ));

  return (
    <div className="pr-page">
      <header className="pr-hero">
        <div className="pr-wrap">
          <span className="pr-kicker">Dedicated</span>
          <h1 className="pr-hero-title">The whole machine. Yours.</h1>
          <p className="pr-hero-sub">
            Single-tenant servers with dedicated cores, memory and storage, full root access and no neighbours. Priced monthly, in rupees.
          </p>
        </div>
      </header>
      <div className="pr-wrap ds-public">
        <DedicatedCatalog servers={data?.servers} categories={data?.categories} delivery={data?.delivery}
          loading={!data && !error} error={error} action={action} />
      </div>
    </div>
  );
};

export default DedicatedServers;
