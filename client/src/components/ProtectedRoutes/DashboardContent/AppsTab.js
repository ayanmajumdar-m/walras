import React from "react";
import { Link } from "react-router-dom";
import { Rocket, Trash2, Undo2 } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Resources → Apps: the account's App Platform apps. Cancelling ends one at
  the end of the paid month, like a server.
*/

const until = (d) => new Date(new Date(d).getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const AppsTab = ({ apps, reload, notify }) => {
  const canDelete = useConsole().can("delete");

  const cancel = async (a) => {
    const paid = a.paidUntil ? until(a.paidUntil) : "the end of this month";
    if (!window.confirm(`Cancel the app on ${a.domain}? It's paid until ${paid} and keeps running until then; it won't be renewed, and is then deleted. You can undo this until then.`)) return;
    try {
      const r = await api(`/api/apps/${a.id}`, { method: "DELETE" });
      notify(r.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };
  const keep = async (a) => {
    try {
      const r = await api(`/api/apps/${a.id}/keep`, { method: "POST" });
      notify(r.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };

  if (apps.length === 0) {
    return (
      <div className="cx-card cx-empty">
        <span className="cx-empty-icon"><Rocket size={26} aria-hidden="true" /></span>
        <h4>No apps yet</h4>
        <p>Deploy your app on your own domain with App Platform.</p>
        <Link to="/dashboard/create?type=apps" className="cx-btn cx-btn-ghost">See App Platform plans</Link>
      </div>
    );
  }

  return (
    <div className="cx-card cx-table-wrap">
      <table className="cx-table">
        <thead><tr><th>Domain</th><th>Location</th><th>Plan</th><th>Status</th><th>Cost</th><th /></tr></thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td data-label="Domain"><strong>{a.domain}</strong></td>
              <td data-label="Location">{a.location || "—"}</td>
              <td data-label="Plan">{a.plan}<small>{a.type === "dedicated" ? "Dedicated" : "Shared"}</small></td>
              <td data-label="Status">
                {a.suspended ? <span className="cx-status is-suspended">suspended</span> : <span className={`cx-status is-${a.status}`}>{a.status}</span>}
                {a.cancelAt && <small className="is-warn">Cancelled: runs until {until(a.cancelAt)}</small>}
                {a.suspended && <small className="is-danger"><Link to="/dashboard/billing?tab=invoices">Unpaid invoice</Link></small>}
              </td>
              <td data-label="Cost">₹{Number(a.monthlyCost).toLocaleString("en-IN")}/mo</td>
              <td className="cx-actions">
                {canDelete && (a.cancelAt
                  ? <button type="button" className="cx-icon-btn" onClick={() => keep(a)} title="Undo cancellation"><Undo2 size={15} /></button>
                  : <button type="button" className="cx-icon-btn is-danger" onClick={() => cancel(a)} title="Cancel plan"><Trash2 size={15} /></button>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AppsTab;
