import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FolderPlus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import { useAuth } from '../context/useAuth';
import Navbar from '../components/Navbar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';

const CARD_COLORS = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState(() => location.state?.search || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchProjects);
  }, [fetchProjects]);

  const handleCreateProject = async (event) => {
    event.preventDefault();
    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      setShowForm(false);
      toast.success('Project created');
      await fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create project. Please try again.');
    }
  };

  const handleDeleteProject = async (event, projectId) => {
    event.stopPropagation();
    if (!window.confirm('Delete this project? This cannot be undone.')) return;

    try {
      await api.delete(`/projects/${projectId}`);
      toast.success('Project deleted');
      await fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to delete project. Please try again.');
    }
  };

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()));
  }, [projects, search]);

  const firstName = user?.email?.split('@')[0];

  if (loading) {
    return (
      <div className="app-page">
        <Navbar showUser onSearch={setSearch} />
        <div className="page-container space-y-5" role="status" aria-label="Loading projects">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72 max-w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-48" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <Navbar showUser onSearch={setSearch} />

      <main className="page-container">
        <header className="mb-8">
          <h1 className="page-heading">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {projects.length === 0
              ? "You don't have any projects yet"
              : `${projects.length} project${projects.length > 1 ? 's' : ''} in your workspace`}
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={17} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              placeholder="Search projects..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search projects"
              className="pl-10"
            />
          </div>
          <Button
            variant={showForm ? 'secondary' : 'primary'}
            onClick={() => setShowForm((shown) => !shown)}
          >
            <FolderPlus size={17} aria-hidden="true" />
            {showForm ? 'Cancel' : 'New project'}
          </Button>
        </div>

        {showForm && (
          <Card as="form" onSubmit={handleCreateProject} className="mb-8 p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                Project name
                <Input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoFocus
                  maxLength={100}
                  placeholder="e.g. Website refresh"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                Description
                <Input
                  type="text"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  placeholder="What are you working on?"
                />
              </label>
            </div>
            <Button type="submit">
              <FolderPlus size={16} aria-hidden="true" />
              Create project
            </Button>
          </Card>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="A fresh start"
            description="Create your first project to bring tasks and plans into one focused space."
            action={(
              <Button onClick={() => setShowForm(true)}>
                <FolderPlus size={17} aria-hidden="true" />
                Create a project
              </Button>
            )}
          />
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching projects"
            description={`We couldn't find a project matching “${search}”. Try another search.`}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                onClick={() => navigate(`/project/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    if (event.target !== event.currentTarget) return;
                    event.preventDefault();
                    navigate(`/project/${project.id}`);
                  }
                }}
                role="link"
                tabIndex={0}
                aria-label={`Open project ${project.name}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.2) }}
                className="ui-card project-card group"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl font-semibold ${CARD_COLORS[index % CARD_COLORS.length]}`}>
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => handleDeleteProject(event, project.id)}
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </div>

                <h2 className="mb-1 font-semibold tracking-tight text-foreground">{project.name}</h2>
                <p className="mb-4 line-clamp-2 min-h-10 text-sm text-muted">
                  {project.description || 'No description'}
                </p>

                <div className="flex items-center justify-between">
                  <Badge tone="primary">Project</Badge>
                  <span className="text-xs font-semibold text-primary">Open project →</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
