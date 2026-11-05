import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import Navbar from '../components/Navbar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';

const ArchivedProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    document.title = 'Archived - NOVA';
  }, []);

  const fetchArchivedProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, headers } = await api.get('/projects/archived', { params: { limit: 50, offset: 0 } });
      setProjects(data);
      setHasMore(Number(headers?.['x-total-count'] || data.length) > data.length);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load archived projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = projects.length;
      const { data, headers } = await api.get('/projects/archived', { params: { limit: 50, offset } });
      setProjects((current) => [...current, ...data]);
      setHasMore(Number(headers?.['x-total-count'] || offset + data.length) > offset + data.length);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load more archived projects.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchArchivedProjects);
    window.addEventListener('nova:projects-changed', fetchArchivedProjects);
    return () => window.removeEventListener('nova:projects-changed', fetchArchivedProjects);
  }, [fetchArchivedProjects]);

  const restoreProject = async (projectId) => {
    try {
      await api.post(`/projects/${projectId}/restore`);
      setProjects((current) => current.filter((project) => project.id !== projectId));
      window.dispatchEvent(new Event('nova:projects-changed'));
      toast.success('Project restored');
    } catch (actionError) {
      toast.error(actionError.response?.data?.error || 'Unable to restore project.');
    }
  };

  const deleteProjectPermanently = async (project) => {
    if (!window.confirm(`Permanently delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project.id}/permanent`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      window.dispatchEvent(new Event('nova:projects-changed'));
      toast.success('Project permanently deleted');
    } catch (actionError) {
      toast.error(actionError.response?.data?.error || 'Unable to permanently delete project.');
    }
  };

  return (
    <div className="app-page">
      <Navbar pageTitle="Archived" />
      <main className="page-container">
        <header className="page-header">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-primary">Workspace</p>
            <h1 className="page-heading">Archived projects</h1>
            <p className="mt-1 text-sm text-muted">Restore a project or permanently remove it from your workspace.</p>
          </div>
        </header>

        {loading ? (
          <section className="space-y-3" role="status" aria-label="Loading archived projects">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20" />)}
          </section>
        ) : error ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5" role="alert">
            <p className="text-sm text-danger">{error}</p>
            <Button variant="secondary" onClick={() => { void fetchArchivedProjects(); }}>Retry</Button>
          </Card>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="No archived projects"
            description="Projects you archive will be kept here so you can restore them later."
            action={<Link className="ui-button button-secondary" to="/dashboard">Back to dashboard</Link>}
          />
        ) : (
          <>
          <ul className="space-y-3" aria-label="Archived projects">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <Archive size={17} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{project.name}</span>
                  <span className="block truncate text-xs text-muted">{project.description || 'No description'}</span>
                </span>
                {project.role === 'owner' && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => restoreProject(project.id)}>
                      <RotateCcw size={14} aria-hidden="true" />
                      Restore
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteProjectPermanently(project)}>
                      <Trash2 size={14} aria-hidden="true" />
                      Delete permanently
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {hasMore && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more archived projects'}</Button></div>}
          </>
        )}
      </main>
    </div>
  );
};

export default ArchivedProjects;
