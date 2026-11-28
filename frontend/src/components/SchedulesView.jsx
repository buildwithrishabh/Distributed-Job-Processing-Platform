import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../api";
import { errorText, fmtDate, shortId } from "../utils";
import { ErrorPanel, PageHeading } from "./Common";
import { LoadingRows, Pagination } from "./JobsTable";

const SCHEDULE_STATUSES = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "PAUSED", label: "PAUSED" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const statusBadgeClass = (status) => {
  if (status === "ACTIVE" || status === "COMPLETED") return "COMPLETED";
  if (status === "PAUSED") return "RETRYING";
  if (status === "CANCELLED") return "CANCELLED";
  return "PENDING";
};

export function SchedulesView({ onSelectSchedule, onCreate, notify }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .schedules(page, 10, status)
      .then(setData)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (event, scheduleId, actionFn, successMsg) => {
    event.stopPropagation();
    setBusyId(scheduleId);
    try {
      await actionFn(scheduleId);
      notify(successMsg);
      load();
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusyId("");
    }
  };

  const filtered = (data?.schedules || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.scheduleId?.toLowerCase().includes(q) ||
      s.cronExpression?.toLowerCase().includes(q) ||
      s.payload?.to?.toLowerCase().includes(q)
    );
  });

  const pagination = data?.pagination || {};
  const pages = Math.max(1, pagination.totalPages || 1);

  return (
    <>
      <PageHeading
        eyebrow="SCHEDULER"
        title="Schedules"
        description="Manage one-time and recurring cron job schedules across timezones."
        action={
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Create schedule
          </button>
        }
      />

      <section className="panel list-panel">
        <div className="list-toolbar">
          <div className="search-input-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by name, ID, cron, or recipient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="icon-button"
                aria-label="Clear search"
                style={{ width: 20, height: 20 }}
                onClick={() => setSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="filter-label">
            <span>Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "6px 10px",
                fontSize: "13px",
              }}
            >
              {SCHEDULE_STATUSES.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-right">
            <span>
              {data
                ? `${pagination.total ?? filtered.length} schedules`
                : "Loading schedules"}
            </span>
            <button
              className="icon-button bordered"
              onClick={load}
              title="Refresh"
              aria-label="Refresh schedules"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {error ? (
          <ErrorPanel message={error} onRetry={load} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Timing</th>
                  <th>Status</th>
                  <th>Next Run</th>
                  <th>Last Run</th>
                  <th>Runs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows cols={7} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <CalendarClock size={22} />
                        <strong>No schedules found</strong>
                        <p>Create a one-time or recurring cron schedule to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr
                      key={s.scheduleId}
                      className="clickable-row"
                      onClick={() => onSelectSchedule(s.scheduleId)}
                    >
                      <td>
                        <strong>{s.name}</strong>
                        <div className="muted mono" style={{ fontSize: "12px" }}>
                          {shortId(s.scheduleId)}
                        </div>
                      </td>
                      <td>
                        <div>
                          <span className="priority">{s.scheduleType}</span>{" "}
                          <span className="mono" style={{ fontSize: "12px" }}>
                            {s.scheduleType === "RECURRING"
                              ? s.cronExpression
                              : fmtDate(s.runAt)}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: "12px" }}>
                          {s.timezone || "UTC"}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${statusBadgeClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{fmtDate(s.nextRunAt)}</td>
                      <td>{fmtDate(s.lastRunAt)}</td>
                      <td>
                        <span>{s.runCount ?? 0}</span>
                        {s.failureCount > 0 && (
                          <span style={{ color: "var(--red-text)", marginLeft: 6 }}>
                            ({s.failureCount} failed)
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {s.status === "ACTIVE" && (
                            <button
                              className="button small secondary"
                              disabled={busyId === s.scheduleId}
                              onClick={(e) =>
                                runAction(e, s.scheduleId, api.pauseSchedule, "Schedule paused.")
                              }
                            >
                              {busyId === s.scheduleId ? (
                                <LoaderCircle size={12} className="spin" />
                              ) : (
                                <Pause size={12} />
                              )}{" "}
                              Pause
                            </button>
                          )}
                          {s.status === "PAUSED" && (
                            <button
                              className="button small primary"
                              disabled={busyId === s.scheduleId}
                              onClick={(e) =>
                                runAction(e, s.scheduleId, api.resumeSchedule, "Schedule resumed.")
                              }
                            >
                              {busyId === s.scheduleId ? (
                                <LoaderCircle size={12} className="spin" />
                              ) : (
                                <Play size={12} />
                              )}{" "}
                              Resume
                            </button>
                          )}
                          {["COMPLETED", "CANCELLED"].includes(s.status) && (
                            <button
                              className="button small danger"
                              disabled={busyId === s.scheduleId}
                              onClick={(e) =>
                                runAction(e, s.scheduleId, api.deleteSchedule, "Schedule deleted.")
                              }
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={pagination.total || 0}
          limit={pagination.limit || 10}
          onChange={setPage}
        />
      </section>

      <p className="footnote">
        <Shield size={13} /> Distributed lock + atomic claim protected scheduler.
      </p>
    </>
  );
}

export default SchedulesView;
