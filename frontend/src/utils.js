import {
  Activity,
  AlertCircle,
  Cpu,
  LayoutDashboard,
} from "lucide-react";

export const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: Activity },
  { id: "dead", label: "Dead letter queue", icon: AlertCircle },
  { id: "workers", label: "Workers", icon: Cpu },
];

export const statuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "RETRYING",
  "DEAD",
  "CANCELLED",
];

export const STATUS_OPTIONS = [
  { value: "", label: "All statuses", desc: "Show all queued & processed jobs" },
  { value: "PENDING", label: "PENDING", desc: "Waiting in queue to be picked up" },
  { value: "PROCESSING", label: "PROCESSING", desc: "Actively executing on a worker" },
  { value: "COMPLETED", label: "COMPLETED", desc: "Executed successfully without errors" },
  { value: "FAILED", label: "FAILED", desc: "Encountered execution failure" },
  { value: "RETRYING", label: "RETRYING", desc: "Waiting for exponential retry" },
  { value: "DEAD", label: "DEAD", desc: "Moved to dead-letter queue" },
  { value: "CANCELLED", label: "CANCELLED", desc: "Aborted or cancelled by user" },
];

export const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

export const shortId = (value = "") =>
  value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-5)}` : value;

export const errorText = (error) =>
  error?.details?.map((item) => `${item.field}: ${item.message}`).join(" · ") ||
  error?.message ||
  "Something went wrong.";
