import React, { useEffect, useRef, useState } from "react";
import { Bell, UserPlus, Receipt, AlertTriangle, PhoneCall } from "lucide-react";
import { adminApi, fmtDate } from "../adminApi";

const ICONS = { signup: UserPlus, order: Receipt, payment_failed: AlertTriangle, callback: PhoneCall };
const POLL_MS = 60 * 1000;

/**
 * Header bell: recent sign-ups, failed payments and waiting Support +
 * call-back requests.
 * Polls every minute; opening it marks everything as seen for this admin.
 */
const NotificationsBell = ({ openCustomer, openSection }) => {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => adminApi("/notifications").then(setData).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && data.unread > 0) {
      adminApi("/notifications/seen", { method: "POST" }).then(() => setData((d) => ({ ...d, unread: 0 }))).catch(() => {});
    }
  };

  return (
    <div className="ap-bell" ref={ref}>
      <button type="button" className="cx-icon-btn ap-bell-btn" onClick={toggle} aria-label={`Notifications${data.unread ? `, ${data.unread} new` : ""}`}>
        <Bell size={17} />
        {data.unread > 0 && <span className="ap-bell-dot">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <div className="ap-bell-panel" role="dialog" aria-label="Notifications">
          <div className="ap-bell-head">Notifications <small>last 14 days</small></div>
          {data.items.length === 0 ? (
            <p className="ap-muted ap-pad">Nothing new.</p>
          ) : (
            <ul>
              {data.items.map((n, i) => {
                const Icon = ICONS[n.kind] || Bell;
                return (
                  <li key={i}>
                    <button type="button" onClick={() => { setOpen(false); if (n.section) openSection(n.section); else if (n.userId) openCustomer(n.userId); }}>
                      <span className={`ap-bell-icon is-${n.kind}`}><Icon size={15} /></span>
                      <span className="ap-bell-text">
                        <strong>{n.title}</strong>
                        <small>{n.body}</small>
                        <small className="ap-muted">{fmtDate(n.at, true)}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
