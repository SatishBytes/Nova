import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Circle, ListChecks } from 'lucide-react';
import api from '../api/axiosInstance';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();
  usePageTitle('My tasks');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard/summary', { params: { limit: 50, offset: 0 } });
      setTasks(data.my_tasks || []);
      setHasMore((data.my_tasks_total || 0) > (data.my_tasks || []).length);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load your tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get('/dashboard/summary', { params: { limit: 50, offset: tasks.length } });
      setTasks((current) => [...current, ...(data.my_tasks || [])]);
      setHasMore((data.my_tasks_total || 0) > tasks.length + (data.my_tasks || []).length);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load more tasks.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchTasks);
  }, [fetchTasks]);

  return (
    <div className="app-page">
      <Navbar pageTitle="My tasks" />
      <main className="page-container">
        <header className="page-header">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-primary">Workspace</p>
            <h1 className="page-heading">My tasks</h1>
            <p className="mt-1 text-sm text-muted">Open tasks assigned to you across projects.</p>
          </div>
        </header>
        {loading ? (
          <section className="space-y-3" role="status" aria-label="Loading your tasks">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-16" />)}
          </section>
        ) : error ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => { void fetchTasks(); }}>Retry</Button>
          </Card>
        ) : tasks.length ? (
          <>
          <ul className="space-y-2" aria-label="Tasks assigned to you">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:bg-accent"
                  onClick={() => navigate(`/project/${task.project_id}?task=${task.id}`)}
                >
                  <Circle size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted">{task.project_name}</span>
                  </span>
                  <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>
                    {task.priority || 'medium'}
                  </Badge>
                  {task.due_date && <time className="hidden shrink-0 text-xs text-muted sm:block" dateTime={task.due_date}>{task.due_date}</time>}
                </button>
              </li>
            ))}
          </ul>
          {hasMore && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more tasks'}</Button></div>}
          </>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No tasks assigned to you"
            description="Tasks assigned to you across your projects will appear here."
            action={<Link className="ui-button button-secondary" to="/dashboard">Back to dashboard</Link>}
          />
        )}
      </main>
    </div>
  );
};

export default MyTasks;
