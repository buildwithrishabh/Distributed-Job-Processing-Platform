import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Server,
  PencilRuler,
  Send,
  FileText,
  KeyRound,
  ArrowRight,
  Activity,
  Plus,
} from 'lucide-react';
import { useOverviewQuery, useJobsQuery, useWorkersQuery } from '../hooks/useQueries';
import { useUI } from '../context/UIContext';
import { StatSkeleton, StatusBadge, formatTime, useCountUp, formatNumber } from './ui';

const LAUNCHERS = [
  { key: 'welcome', icon: <Send size={20} />, title: 'Welcome Email', desc: 'Onboarding template' },
  { key: 'invoice', icon: <FileText size={20} />, title: 'Invoice Email', desc: 'Billing receipt' },
  { key: 'reset', icon: <KeyRound size={20} />, title: 'Password Reset', desc: 'Auth token email' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { openCreateJob, openJobDrawer } = useUI();
  const { data, isLoading, isError, refetch } = useOverviewQuery();
  const { data: jobsData } = useJobsQuery({ page: 1, limit: 5, status: '' });
  const { data: workerData } = useWorkersQuery();

  const queue = data?.queue || {};
  const jobs = data?.jobs || {};
  const workers = data?.workers || {};

  const waiting = queue.waiting ?? jobs.PENDING ?? 0;
  const active = queue.active ?? jobs.PROCESSING ?? 0;
  const activeTotal = waiting + active;
  const completed = queue.completed ?? jobs.COMPLETED ?? 0;
  const failed = (queue.failed ?? 0) + (jobs.DEAD ?? 0);
  const totalJobs = jobs.total ?? 0;

  const recentJobs = jobsData?.jobs?.slice(0, 5) || [];
  const workerList = workers.workers || workerData?.workers || [];
  const healthyWorkers = workerList.filter((w) => w.health === 'HEALTHY').length;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-intro compact">
          <h1>Dashboard <span className="text-gradient">Overview</span></h1>
          <p>Monitor active queues, dispatch test jobs, and check worker health.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreateJob('welcome')}>
          <Plus size={18} /> New Job Dispatch
        </button>
      </div>

      {isError && (
        <div className="state-box error-card alert-inline">
          <AlertTriangle size={24} color="var(--danger)" className="shrink-0" />
          <div className="flex-1">
            <div className="state-title danger alert-title">
              Backend Connection Offline
            </div>
            <div className="state-sub alert-sub">
              Could not connect to API server or database. Ensure MongoDB and Redis are running locally.
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-4 section-gap">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              variant="info"
              icon={<Clock size={22} />}
              label="Active Queued"
              value={activeTotal}
              sub={`${waiting} pending · ${active} running`}
              onClick={() => navigate('/jobs')}
            />
            <StatCard
              variant="success"
              icon={<CheckCircle2 size={22} />}
              label="Completed"
              value={completed}
              sub="successfully processed"
              onClick={() => navigate('/jobs?status=COMPLETED')}
            />
            <StatCard
              variant="danger"
              icon={<AlertTriangle size={22} />}
              label="Failed / DLQ"
              value={failed}
              sub="requires attention"
              onClick={() => navigate('/dlq')}
            />
            <StatCard
              variant="primary"
              icon={<Server size={22} />}
              label="Workers Online"
              value={workerList.length}
              sub={`${healthyWorkers} healthy nodes`}
              onClick={() => navigate('/workers')}
            />
          </>
        )}
      </div>

      <div className="grid grid-2">
        <div className="card pad">
          <div className="card-head">
            <div>
              <div className="card-title">Quick Job Dispatcher</div>
              <div className="card-sub">Click a preset below to instantly queue a background job</div>
            </div>
          </div>

          <div className="quick-grid two">
            {LAUNCHERS.map((l) => (
              <button
                key={l.key}
                className="quick-btn"
                onClick={() => openCreateJob(l.key)}
              >
                <span className="q-ico">
                  {l.icon}
                </span>
                <div>
                  <span className="q-title">{l.title}</span>
                  <span className="q-desc">{l.desc}</span>
                </div>
              </button>
            ))}

            <button
              className="quick-btn dashed"
              onClick={() => openCreateJob('custom')}
            >
              <span className="q-ico purple">
                <PencilRuler size={20} />
              </span>
              <div>
                <span className="q-title">Custom Payload</span>
                <span className="q-desc">Custom type & JSON data</span>
              </div>
            </button>
          </div>
        </div>

        <div className="card pad">
          <div className="card-head">
            <div>
              <div className="card-title">Recent Activity</div>
              <div className="card-sub">Latest background jobs dispatched</div>
            </div>
            <button className="btn btn-ghost btn-sm btn-strong" onClick={() => navigate('/jobs')}>
              View All <ArrowRight size={15} />
            </button>
          </div>

          {recentJobs.length > 0 ? (
            <div className="recent-list">
              {recentJobs.map((job) => (
                <div
                  key={job._id || job.jobId}
                  className="recent-item"
                  onClick={() => openJobDrawer(job)}
                >
                  <span className="recent-id">
                    <span className="code-pill">{job.jobId}</span>
                  </span>
                  <span className="recent-meta">
                    <StatusBadge status={job.status} />
                    <span className="cell-muted">{formatTime(job.createdAt)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="state-box">
              <Activity size={28} className="faint" />
              <div className="state-sub">No recent jobs dispatched yet</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ variant, icon, label, value, sub, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  const animated = useCountUp(value);
  return (
    <Comp
      className={`stat-card${onClick ? ' clickable' : ''} ${variant}`}
      onClick={onClick}
    >
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{formatNumber(animated)}</div>
          <div className="stat-sub">{sub}</div>
        </div>
        <span className={`stat-ico ${variant}`}>{icon}</span>
      </div>
    </Comp>
  );
}
