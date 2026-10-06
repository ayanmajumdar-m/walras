import React, { useCallback, useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import Dashboard from "../components/Dashboard";
import Transactions from "../components/Transactions";
import Invoices from "../components/Invoices";
import Servers from "../components/Servers";
import PromoCodes from "../components/PromoCodes";
import CreatePromoForm from "../components/CreatePromoForm";
import Domain from "../components/Domain";
import Hosting from "../components/Hosting";

/*
  The pre-existing admin views, each wrapped with its own data loading so
  they slot into the new panel unchanged. Styling comes from .ap-legacy in
  AdminConsole.css.
*/

const formatCurrency = (amount) => `₹${(Number(amount || 0) / 100).toFixed(2)}`;
const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

const Page = ({ title, subtitle, action, children }) => (
  <div className="cx-page">
    <div className="cx-page-head cx-page-head-row">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
    <div className="ap-legacy">{children}</div>
  </div>
);

const useLoad = (fn) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    fn().then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);
  return { data, error, load };
};

const ErrorNote = ({ error }) => (error ? <div className="cx-alert is-error">{error}</div> : null);

export const DashboardSection = () => {
  const stats = useLoad(() => adminApi("/dashboardStats").then((d) => (Array.isArray(d) ? d[0] : d)));
  const activity = useLoad(() => adminApi("/getRecentActivity"));
  const support = useLoad(() => adminApi("/support/summary"));
  const s = support.data;
  return (
    <Page title="Dashboard" subtitle="Platform at a glance.">
      <ErrorNote error={stats.error} />
      {s && (
        <div className="cx-alert is-info">
          <span>
            {!s.configured
              ? "Support tickets: Zendesk isn't connected yet (set the ZENDESK_* environment variables)."
              : s.openTickets === null
                ? "Support tickets: couldn't reach Zendesk just now."
                : `${s.openTickets} unsolved support ticket${s.openTickets === 1 ? "" : "s"} in Zendesk.`}
          </span>
          {s.agentUrl && <a href={s.agentUrl} target="_blank" rel="noreferrer" className="cx-link">Open Zendesk</a>}
        </div>
      )}
      <Dashboard dashboardStats={stats.data || {}} recentActivity={activity.data || []} formatCurrency={formatCurrency} formatDate={formatDate} />
    </Page>
  );
};

export const TransactionsSection = () => {
  const { data, error } = useLoad(() => adminApi("/getAllTransactions"));
  return (
    <Page title="Transactions" subtitle="Every account balance credit and debit.">
      <ErrorNote error={error} />
      <Transactions transactions={data || []} formatCurrency={formatCurrency} formatDate={formatDate} />
    </Page>
  );
};

export const InvoicesSection = ({ can, notify }) => {
  const { data, error, load } = useLoad(() => adminApi(`/monthly-invoices?t=${Date.now()}`).then((d) => d.invoices || d));
  return (
    <Page title="Invoices" subtitle="Monthly tax invoices.">
      <ErrorNote error={error} />
      <Invoices
        invoices={data || []}
        loading={!data && !error}
        adminInfo={{ access: can("manage_billing") ? "owner" : "billing" }}
        token={localStorage.getItem("adminToken")}
        setMessage={({ text, type }) => notify(text, type)}
        fetchInvoices={load}
        formatDate={formatDate}
      />
    </Page>
  );
};

export const PromoCodesSection = ({ notify }) => {
  const { data, error, load } = useLoad(() => adminApi(`/promo-codes?t=${Date.now()}`).then((d) => d.promoCodes || d));
  const [creating, setCreating] = useState(false);
  const [codes, setCodes] = useState(null);
  const list = codes || data || [];

  const remove = async (id) => {
    if (!window.confirm("Delete this promo code?")) return;
    try {
      await adminApi(`/promo-codes/${id}`, { method: "DELETE" });
      notify("Promo code deleted", "success");
      setCodes(null);
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <Page
      title="Promo codes"
      subtitle="Account balance credit codes for customers."
    >
      <ErrorNote error={error} />
      <PromoCodes
        promoCodes={list}
        setShowCreatePromo={setCreating}
        deletePromoCode={remove}
        formatDate={formatDate}
        onPromoUpdate={(updated) => setCodes(list.map((p) => (p.id === updated.id ? updated : p)))}
      />
      {creating && (
        <CreatePromoForm
          onSuccess={() => { setCreating(false); setCodes(null); load(); notify("Promo code created", "success"); }}
          onCancel={() => setCreating(false)}
        />
      )}
    </Page>
  );
};

export const ServersSection = () => {
  const { data, error } = useLoad(() => adminApi("/getAllServers"));
  return (
    <Page title="Cloud servers" subtitle="Every customer server.">
      <ErrorNote error={error} />
      <Servers servers={data || []} formatCurrency={formatCurrency} formatDate={formatDate} />
    </Page>
  );
};

export const HostingSection = ({ notify }) => {
  const { data, error, load } = useLoad(() => adminApi("/getAllHosting").then((d) => d.hostingAccounts || []));
  const call = (fn, ok) => fn().then(() => { notify(ok, "success"); load(); }).catch((e) => notify(e.message, "error"));
  return (
    <Page title="Web hosting" subtitle="Every cPanel account.">
      <ErrorNote error={error} />
      <Hosting
        hostingAccounts={data || []}
        onSuspend={(id, reason) => call(() => adminApi(`/hosting/${id}/suspend`, { method: "POST", body: { reason } }), "Hosting account suspended")}
        onUnsuspend={(id) => call(() => adminApi(`/hosting/${id}/unsuspend`, { method: "POST" }), "Hosting account reinstated")}
        onDelete={(id) => call(() => adminApi(`/hosting/${id}`, { method: "DELETE" }), "Hosting account deleted")}
        onLogin={(id) => adminApi(`/hosting/${id}/login`).then((d) => d.url && window.open(d.url, "_blank", "noopener")).catch((e) => notify(e.message, "error"))}
        onRefresh={load}
        formatDate={formatDate}
      />
    </Page>
  );
};

export const DomainsSection = () => (
  <Page title="Domains" subtitle="Domains registered through Walras Cloud.">
    <Domain />
  </Page>
);
