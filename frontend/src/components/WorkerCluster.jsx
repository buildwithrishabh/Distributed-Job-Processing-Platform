import React from 'react';
import { Server, Activity, Cpu, HardDrive, Users, Terminal, RefreshCw, Wifi } from 'lucide-react';
import { useWorkersQuery } from '../hooks/useQueries';
import { Skeleton, ErrorState, EmptyState, formatRelative, Copyable } from './ui';

function healthMeta(health) {
  switch (health) {
    case 'HEALTHY':
      return { label: 'Healthy', cls: 'badge-healthy', val: 'healthy' };
    case 'STALE':
      return { label: 'Stale', cls: 'badge-stale', val: 'stale' };
    case 'DEAD':
      return { label: 'Dead', cls: 'badge-dead2', val: 'dead' };
    default:
      return { label: 'Healthy', cls: 'badge-healthy', val: 'healthy' };
  }
}

function formatBytes(bytes) {
  if (bytes == null) return '-';
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatUptime(secs) {
  if (secs == null) return '-';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(secs)}s`;
}

export default function WorkerCluster() {
  const { data, isLoading, isError, refetch, isFetching } = useWorkersQuery();

  const workers = data?.workers || [];
  const activeCount = data?.activeWorkerCount ?? workers.length;
  const healthy = workers.filter((w) => w.health === 'HEALTHY').length;
  const stale = workers.filter((w) => w.health === 'STALE').length;
  const dead = workers.filter((w) => w.health === 'DEAD').length;

  return (
    <div className="fade-in">
      <div className="page-head">
        <div className="page-intro compact">
          <h1>Worker Cluster Telemetry</h1>
          <p>Monitor BullMQ node processes competing to execute background queue jobs.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={refetch}>
          <RefreshCw size={14} className={isFetching ? 'spin-icon' : ''} /> Refresh Workers
        </button>
      </div>

      <div className="grid grid-stats section-gap">
        <div className="stat-card primary">
          <div className="stat-top">
            <div>
              <div className="stat-label">Active Workers</div>
              <div className="stat-value">{activeCount}</div>
              <div className="stat-sub">reporting nodes</div>
            </div>
            <span className="stat-ico primary"><Server size={22} /></span>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-top">
            <div>
              <div className="stat-label">Healthy</div>
              <div className="stat-value">{healthy}</div>
              <div className="stat-sub">fresh heartbeat</div>
            </div>
            <span className="stat-ico success"><Wifi size={22} /></span>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-top">
            <div>
              <div className="stat-label">Stale</div>
              <div className="stat-value">{stale}</div>
              <div className="stat-sub">heartbeat delayed</div>
            </div>
            <span className="stat-ico warning"><Activity size={22} /></span>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-top">
            <div>
              <div className="stat-label">Dead</div>
              <div className="stat-value">{dead}</div>
              <div className="stat-sub">heartbeat expired</div>
            </div>
            <span className="stat-ico danger"><Server size={22} /></span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="card worker-card pad" key={i}>
              <Skeleton style={{ width: '100%', height: 60 }} />
              <Skeleton style={{ width: '100%', height: 120 }} />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Failed to load worker telemetry" onRetry={refetch} />
      ) : workers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Active Workers Detected"
          subtitle="Spin up background worker instances using Docker Compose or local terminal."
        >
          <span className="chip mono state-chip">
            <Terminal size={14} /> npm run worker
          </span>
        </EmptyState>
      ) : (
        <div className="grid grid-3 section-gap">
          {workers.map((w, idx) => {
            const h = healthMeta(w.health);
            const mem = w.memoryUsage || {};
            const rss = mem.rss;
            return (
              <div className={`card worker-card pad hoverable health-${h.val}`} key={w.workerId || idx}>
                <div className="worker-head">
                  <div className="worker-ico">
                    <Server size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="worker-title-row">
                      <strong className="worker-name">Worker #{idx + 1}</strong>
                      <span className={`badge ${h.cls}`}>{h.label}</span>
                    </div>
                    <div className="worker-id">
                      <Copyable text={w.workerId} display={w.workerId} />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="heartbeat-row">
                    <span>Heartbeat Telemetry</span>
                    <span className={`heartbeat-value ${h.val}`}>
                      {w.lastSeen ? formatRelative(w.lastSeen) : '-'}
                      {w.secondsSinceLastSeen != null ? ` (${w.secondsSinceLastSeen}s)` : ''}
                    </span>
                  </div>
                  <div className="gauge">
                    <div
                      className="gauge-fill"
                      style={{
                        width: h.val === 'healthy' ? '100%' : h.val === 'stale' ? '50%' : '15%',
                        background: h.val === 'healthy' ? 'var(--success)' : h.val === 'stale' ? 'var(--warning)' : 'var(--danger)',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="w-stat">
                    <span className="ws-label"><Cpu size={15} /> Process PID</span>
                    <span className="ws-value mono">{w.pid ?? '-'}</span>
                  </div>
                  <div className="w-stat">
                    <span className="ws-label"><Activity size={15} /> Uptime</span>
                    <span className="ws-value">{formatUptime(w.uptime)}</span>
                  </div>
                  <div className="w-stat">
                    <span className="ws-label"><HardDrive size={15} /> Heap RSS</span>
                    <span className="ws-value">{formatBytes(rss)}</span>
                  </div>
                  <div className="w-stat">
                    <span className="ws-label"><Server size={15} /> Concurrency</span>
                    <span className="ws-value">{w.concurrency || 5} jobs</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card pad-sm scale-out-card">
        <div className="card-title scale-card">
          <Terminal size={18} color="var(--primary)" /> Horizontal Scale-Out Command
        </div>
        <p className="card-sub scale-copy">
          Scale workers dynamically across containers - BullMQ automatically load balances Redis queue jobs.
        </p>
        <span className="chip mono">
          <RefreshCw size={13} /> docker compose up --build --scale worker=5 -d
        </span>
      </div>
    </div>
  );
}
