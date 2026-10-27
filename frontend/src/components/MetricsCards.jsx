import {
  Activity,
  AlertCircle,
  Check,
  Clock3,
} from "lucide-react";

export function Metric({ label, value, icon: Icon, note }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <div className="metric-value">
        {value ?? <span className="skeleton inline" />}
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export function MetricsCards({ stats }) {
  const cards = [
    {
      label: "Total jobs",
      value: stats?.total,
      icon: Activity,
      note: "Across your workspace",
    },
    {
      label: "In progress",
      value:
        (stats?.PENDING || 0) +
        (stats?.PROCESSING || 0) +
        (stats?.RETRYING || 0),
      icon: Clock3,
      note: `${stats?.PROCESSING || 0} currently processing`,
    },
    {
      label: "Completed",
      value: stats?.COMPLETED,
      icon: Check,
      note: "Successfully executed",
    },
    {
      label: "Dead letter",
      value: stats?.DEAD,
      icon: AlertCircle,
      note: "Jobs that exhausted their retries",
    },
  ];

  return (
    <div className="metric-grid">
      {cards.map((item) => (
        <Metric key={item.label} {...item} />
      ))}
    </div>
  );
}

export default MetricsCards;
