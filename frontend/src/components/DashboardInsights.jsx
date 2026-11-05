import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import Card from './ui/Card';

const DashboardInsights = ({ completions, projects, reduceMotion }) => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
      <Card className="min-w-0 p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="font-semibold">Tasks completed</h3>
          <p className="text-xs text-muted">Daily totals over the last 14 days</p>
        </div>
        {completions.length ? (
          <div role="img" aria-label="Bar chart showing tasks completed each day over the last 14 days">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={completions} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value) => [value, 'Completed']}
                  contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: 12 }}
                />
                <Bar dataKey="count" name="Completed" fill="var(--primary)" radius={[5, 5, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="grid h-52 place-items-center text-sm text-muted">Complete a task to start your activity chart.</p>
        )}
      </Card>
      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold">Project progress</h3>
        <p className="mb-4 text-xs text-muted">Completion across active projects</p>
        {projects.length ? (
          <ul className="space-y-4">
            {projects.slice(0, 6).map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between gap-3 text-left text-sm"
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                  <span className="shrink-0 text-xs text-muted">{project.done}/{project.total} · {project.progress}%</span>
                </button>
                <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="grid h-40 place-items-center text-center text-sm text-muted">Create a project to see its progress here.</p>
        )}
      </Card>
    </div>
  );
};

export default DashboardInsights;
