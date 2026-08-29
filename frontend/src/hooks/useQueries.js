import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useSettings } from '../context/SettingsContext';

// Never auto-retry auth/backpressure failures (401 -> the interceptor already
// attempted a silent token rotation and replayed once). Retry transient 5xx.
function retryPolicy(failureCount, error) {
  const status = error?.response?.status;
  if (status === 401 || status === 503) return false;
  return failureCount < 2;
}

function usePollingLag() {
  const { refreshInterval } = useSettings();
  return refreshInterval > 0 ? refreshInterval : false;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export function useHealthQuery() {
  const interval = usePollingLag();
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      // Health lives at root /health (not /api/health) on the backend.
      const res = await api.get('/health', { baseURL: '' });
      return res.data;
    },
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 2000,
  });
}

export function useOverviewQuery() {
  const interval = usePollingLag();
  return useQuery({
    queryKey: ['overview'],
    queryFn: async () => (await api.get('/monitoring/overview')).data,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: retryPolicy,
    staleTime: 2000,
  });
}

export function useJobsQuery({ page = 1, limit = 10, status = '', search = '' }) {
  const interval = usePollingLag();
  const needle = search.trim();

  return useQuery({
    queryKey: ['jobs', { page, limit, status, search: needle }],
    queryFn: async () => {
      // The backend's GET /jobs has no `search` param, so to make search work
      // across the WHOLE dataset (not just the current 10-row page) we pull a
      // large page while a search is active and filter client-side.
      const activeSearch = needle.length > 0;
      const params = { page, limit: activeSearch ? 500 : limit };
      if (status) params.status = status;

      const res = await api.get('/jobs', { params });
      const jobs = res.data.jobs || [];

      const filtered = activeSearch ? jobs.filter((j) => matches(j, needle)) : jobs;

      return {
        jobs: filtered,
        total: res.data.total ?? filtered.length,
        page,
        limit: activeSearch ? 500 : limit,
      };
    },
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: retryPolicy,
    staleTime: 2000,
  });
}

function matches(job, q) {
  const hay = `${job.jobId || ''} ${job.type || ''}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function useDeadJobsQuery({ page = 1, limit = 10 }) {
  const interval = usePollingLag();
  return useQuery({
    queryKey: ['dead-jobs', { page, limit }],
    queryFn: async () => (await api.get('/jobs/dead', { params: { page, limit } })).data,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: retryPolicy,
    staleTime: 2000,
  });
}

export function useWorkersQuery() {
  const interval = usePollingLag();
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => (await api.get('/monitoring/workers')).data,
    refetchInterval: interval,
    refetchIntervalInBackground: false,
    retry: retryPolicy,
    staleTime: 2000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
function useInvalidateAuthed() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['overview'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['dead-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['workers'] });
  };
}

export function useCreateJob() {
  const invalidate = useInvalidateAuthed();
  return useMutation({
    mutationFn: async (jobData) => {
      const headers = {};
      if (jobData.idempotencyKey) headers['idempotency-key'] = jobData.idempotencyKey;
      const res = await api.post('/jobs', jobData, { headers });
      return res.data;
    },
    onSuccess: invalidate,
    retry: false,
  });
}

export function useCancelJob() {
  const invalidate = useInvalidateAuthed();
  return useMutation({
    mutationFn: async (jobId) => {
      const res = await api.delete(`/jobs/${jobId}`);
      return res.data;
    },
    onSuccess: invalidate,
    retry: false,
  });
}

export function useRetryDeadJob() {
  const invalidate = useInvalidateAuthed();
  return useMutation({
    mutationFn: async (jobId) => {
      const res = await api.post(`/jobs/${jobId}/retry`);
      return res.data;
    },
    onSuccess: invalidate,
    retry: false,
  });
}