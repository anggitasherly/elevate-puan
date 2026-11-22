import {
  FlaskConical,
  CheckCircle2,
  PlayCircle,
  CircleStop,
} from "lucide-react";

// Menerima ringkasan eksperimen dari API Growth Insights.
export default function ExperimentOverview({ data }) {
  const summary = data?.summary;

  const experimentStats = [
    {
      label: "Total Experiments",
      value: summary?.total ?? 0,
      icon: FlaskConical,
    },
    {
      label: "Completed",
      value: summary?.completed ?? 0,
      icon: CheckCircle2,
    },
    {
      label: "Running",
      value: summary?.ongoing ?? 0,
      icon: PlayCircle,
    },
    {
      label: "Stopped",
      value: summary?.stopped ?? 0,
      icon: CircleStop,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {experimentStats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article
            key={stat.label}
            className="rounded-2xl border border-pink-line bg-gradient-to-br from-pink-pale via-white to-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-ink/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-pale">
                <Icon size={20} className="text-pink-ink" />
              </div>
            </div>

            <p className="mt-5 text-2xl font-bold text-ink-title">
              {stat.value}
            </p>

            <p className="mt-1 text-sm text-ink-muted">
              {stat.label}
            </p>
          </article>
        );
      })}
    </div>
  );
}
