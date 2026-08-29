import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, Inbox, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useJobsQuery, useCancelJob } from '../hooks/useQueries';
import { useUI } from '../context/UIContext';
import { getErrorMessage } from '../api/client';
import {
  StatusBadge,
  TableSkeleton,
  ErrorState,
  EmptyState,
  Copyable,
  PriorityDots,
  AttemptCount,
  STATUS_ORDER,
  formatTime,
} from './ui';

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function JobTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const { openJobDrawer, openCreateJob, showToast } = useUI();
  const cancelJob = useCancelJob();

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) {
      setStatusFilter(s);
      setPage(1);
    }
  }, [searchParams]);

  const { data, isLoading, isError, refetch, isFetching } = useJobsQuery({
    page,
    limit: 10,
    status: statusFilter,
    search,
  });

  const jobs = data?.jobs || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.limit || 10)));

  const sorted = useMemo(() => {
    const arr = [...jobs];
    arr.sort((a, b) => {
      let av, bv;
      if (sortField === 'createdAt') { av = new Date(a.createdAt || 0).getTime(); bv = new Date(b.createdAt || 0).getTime(); }
      else if (sortField === 'priority') { av = a.priority ?? 0; bv = b.priority ?? 0; }
      else if (sortField === 'attempts') { av = a.attempts ?? 0; bv = b.attempts ?? 0; }
      else if (sortField === 'type') { av = String(a.type); bv = String(b.type); }
      else if (sortField === 'jobId') { av = String(a.jobId); bv = String(b.jobId); }
      else { av = a[sortField]; bv = b[sortField]; }
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [jobs, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) =>
    sortField !== field ? (
      <ArrowUpDown size={12} opacity={0.5} />
    ) : sortDir === 'asc' ? (
      <ArrowUp size={12} />
    ) : (
      <ArrowDown size={12} />
    );

  const handleCancel = async (jobId) => {
    try {
      await cancelJob.mutateAsync(jobId);
      showToast(`Job ${jobId} cancelled successfully`);
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to cancel job'), 'error');
    }
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
    const p = new URLSearchParams(searchParams);
    if (value) p.set('status', value);
    else p.delete('status');
    setSearchParams(p, { replace: true });
  };

  return (
    <div className="fade-in">
      <div className="card toolbar-card">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-input">
              <Search size={16} />
              <input
                className="form-input"
                placeholder="Search by Job ID or type..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="filters-scroll">
              <button
                className={`filter-chip ${statusFilter === '' ? 'active' : ''}`}
                onClick={() => handleStatusFilter('')}
              >
                All
              </button>
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  className={`filter-chip ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => handleStatusFilter(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm" onClick={() => openCreateJob('welcome')}>
              <Plus size={15} /> Dispatch Job
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : isError ? (
        <ErrorState message="Failed to load jobs" onRetry={refetch} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={search ? 'No matching jobs' : statusFilter ? `No ${statusFilter} jobs` : 'No jobs found'}
          subtitle={
            search
              ? `Nothing matches "${search}" for the current filter.`
              : statusFilter
                ? `There are currently no jobs in the "${statusFilter}" state.`
                : 'Submit your first job with the Dispatch button to see it here.'
          }
          actions={
            !search && !statusFilter ? (
              <button className="btn btn-primary btn-sm" onClick={() => openCreateJob('welcome')}>
                <Plus size={15} /> Dispatch a Job
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort('jobId')}>
                    <span className="th-sort">Job ID <SortIcon field="jobId" /></span>
                  </th>
                  <th className="sortable" onClick={() => toggleSort('type')}>
                    <span className="th-sort">Type <SortIcon field="type" /></span>
                  </th>
                  <th>Status</th>
                  <th className="sortable" onClick={() => toggleSort('priority')}>
                    <span className="th-sort">Priority <SortIcon field="priority" /></span>
                  </th>
                  <th className="sortable" onClick={() => toggleSort('attempts')}>
                    <span className="th-sort">Attempts <SortIcon field="attempts" /></span>
                  </th>
                  <th className="sortable" onClick={() => toggleSort('createdAt')}>
                    <span className="th-sort">Created <SortIcon field="createdAt" /></span>
                  </th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((job) => (
                  <tr key={job._id || job.jobId} className="click-row" onClick={() => openJobDrawer(job)}>
                    <td data-label="Job ID">
                      <Copyable text={job.jobId} display={job.jobId.length > 26 ? `${job.jobId.slice(0, 26)}...` : job.jobId} />
                    </td>
                    <td data-label="Type" className="cell-type">{job.type}</td>
                    <td data-label="Status"><StatusBadge status={job.status} /></td>
                    <td data-label="Priority"><PriorityDots value={job.priority ?? 0} /></td>
                    <td data-label="Attempts"><AttemptCount attempts={job.attempts ?? 0} maxAttempts={job.maxAttempts ?? 3} /></td>
                    <td data-label="Created" className="cell-muted">{formatTime(job.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        {job.status === 'PENDING' && (
                          <button
                            className="btn btn-danger btn-icon btn-sm"
                            onClick={() => handleCancel(job.jobId)}
                            title="Cancel job"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!search && (
            <div className="pagination">
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> &middot; {total} total jobs
              </span>
              <span className="pagination-btns">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={15} /> Prev
                </button>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight size={15} />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
