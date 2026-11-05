import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Archive,
  CalendarClock,
  Check,
  Circle,
  FolderPlus,
  ListChecks,
  Search,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/axiosInstance';
import { useAuth } from '../context/useAuth';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';

const DashboardInsights = lazy(() => import('../components/DashboardInsights'));

const CARD_COLORS = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
];

const EMPTY_SUMMARY = {
  stats: { total_projects: 0, open_tasks: 0, due_this_week: 0, completed_this_week: 0, total_tasks: 0 },
  my_tasks: [],
  completions: [],
  project_progress: [],
  has_team_members: false,
};

const PROJECT_TEMPLATES = {
  blank: { label: 'Start from scratch', tasks: [] },
  website: {
    label: 'Website launch',
    tasks: ['Define goals and audience', 'Create page structure', 'Build the first version', 'Review and test', 'Prepare launch'],
  },
  sprint: {
    label: 'Sprint',
    tasks: ['Write sprint goal', 'Prioritize backlog', 'Plan team work', 'Review progress', 'Run sprint retrospective'],
  },
  study: {
    label: 'Study plan',
    tasks: ['Set a learning goal', 'Gather study materials', 'Schedule focused sessions', 'Review key concepts', 'Take a practice test'],
  },
};

const readDismissedOnboarding = (userId) => {
  try {
    return window.localStorage.getItem(`nova-onboarding-dismissed-${userId}`) === 'true';
  } catch {
    return false;
  }
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectCount, setProjectCount] = useState(0);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [search, setSearch] = useState(() => location.state?.search || '');
  const [debouncedProjectSearch, setDebouncedProjectSearch] = useState(() => location.state?.search || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState('blank');
  const [showForm, setShowForm] = useState(false);
  const [projectLayout, setProjectLayout] = useState('grid');
  const [projectSort, setProjectSort] = useState('recent');
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => readDismissedOnboarding(user?.id));
  const [loading, setLoading] = useState(true);
  const [creatingProject, setCreatingProject] = useState(false);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  usePageTitle('Dashboard');

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/summary');
      setSummary(data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load dashboard insights.');
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, headers } = await api.get('/projects', { params: { limit: 50, offset: 0, search: debouncedProjectSearch || undefined } });
      setProjects(data);
      setProjectCount(Number(headers?.['x-total-count'] || data.length));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedProjectSearch]);

  const loadMoreProjects = async () => {
    if (loadingMoreProjects || projects.length >= projectCount) return;
    setLoadingMoreProjects(true);
    try {
      const { data } = await api.get('/projects', { params: { limit: 50, offset: projects.length, search: debouncedProjectSearch || undefined } });
      setProjects((current) => [...current, ...data]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load more projects.');
    } finally {
      setLoadingMoreProjects(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedProjectSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void Promise.resolve().then(fetchProjects);
    void Promise.resolve().then(fetchSummary);
  }, [fetchProjects, fetchSummary]);

  useEffect(() => {
    const refreshProjects = () => {
      void fetchProjects();
      void fetchSummary();
    };
    window.addEventListener('nova:projects-changed', refreshProjects);
    return () => window.removeEventListener('nova:projects-changed', refreshProjects);
  }, [fetchProjects, fetchSummary]);

  useEffect(() => {
    const handleCreateTaskShortcut = () => {
      const editableProject = projects.find((project) => project.role !== 'viewer');
      if (editableProject) {
        navigate(`/project/${editableProject.id}`, { state: { createTask: true } });
      } else {
        setShowForm(true);
      }
    };
    window.addEventListener('nova:create-task', handleCreateTaskShortcut);
    return () => window.removeEventListener('nova:create-task', handleCreateTaskShortcut);
  }, [navigate, projects]);

  useEffect(() => {
    if (!location.state?.openCreateProject) return;
    void Promise.resolve().then(() => {
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    });
  }, [location.pathname, location.state, navigate]);

  const handleCreateProject = async (event) => {
    event.preventDefault();
    if (creatingProject) return;
    setCreatingProject(true);
    try {
      const { data: project } = await api.post('/projects', { name: name.trim(), description: description.trim() });
      const starterTasks = PROJECT_TEMPLATES[template]?.tasks || [];
      let createdTasks = 0;
      let failedToAddTask = false;
      for (const title of starterTasks) {
        try {
          await api.post('/tasks', { project_id: project.id, title, status: 'todo' });
          createdTasks += 1;
        } catch {
          failedToAddTask = true;
          break;
        }
      }
      setName('');
      setDescription('');
      setTemplate('blank');
      setShowForm(false);
      if (failedToAddTask) {
        toast.error(`Project created, but only ${createdTasks} of ${starterTasks.length} starter tasks were added.`);
      } else {
        toast.success(createdTasks ? `Project created with ${createdTasks} starter tasks` : 'Project created');
      }
      await fetchProjects();
      await fetchSummary();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create project. Please try again.');
    } finally {
      setCreatingProject(false);
    }
  };

  const restoreProject = async (projectId) => {
    try {
      await api.post(`/projects/${projectId}/restore`);
      toast.success('Project restored');
      window.dispatchEvent(new Event('nova:projects-changed'));
      await Promise.all([fetchProjects(), fetchSummary()]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to restore project.');
    }
  };

  const handleArchiveProject = async (event, projectId) => {
    event.stopPropagation();
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((current) => current.filter((project) => project.id !== projectId));
      window.dispatchEvent(new Event('nova:projects-changed'));
      void fetchSummary();
      toast('Project archived', {
        description: 'Your tasks and team are preserved.',
        action: { label: 'Undo', onClick: () => { void restoreProject(projectId); } },
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to archive project. Please try again.');
    }
  };

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      window.localStorage.setItem(`nova-onboarding-dismissed-${user?.id}`, 'true');
    } catch {
      toast.error('Unable to save this preference on this device.');
    }
  };

  const filteredProjects = useMemo(() => {
    const filtered = search.trim()
      ? projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()))
      : [...projects];
    if (projectSort === 'name') filtered.sort((left, right) => left.name.localeCompare(right.name));
    if (projectSort === 'progress') {
      filtered.sort((left, right) => (
        (summary.project_progress.find((item) => item.project_id === right.id)?.progress || 0)
        - (summary.project_progress.find((item) => item.project_id === left.id)?.progress || 0)
      ));
    }
    if (projectSort === 'recent') {
      filtered.sort((left, right) => new Date(right.recent_activity_at || 0) - new Date(left.recent_activity_at || 0));
    }
    return filtered;
  }, [projectSort, projects, search, summary.project_progress]);

  const firstName = user?.email?.split('@')[0];
  const stats = summary.stats || EMPTY_SUMMARY.stats;
  const onboardingItems = [
    { title: 'Create a project', complete: projects.length > 0, icon: FolderPlus },
    { title: 'Add your first task', complete: stats.total_tasks > 0, icon: ListChecks },
    { title: 'Invite a teammate', complete: summary.has_team_members, icon: Users },
  ];
  const incompleteOnboarding = onboardingItems.filter((item) => !item.complete);

  const followOnboardingStep = (stepTitle) => {
    if (stepTitle === 'Create a project') {
      setShowForm(true);
      return;
    }
    if (stepTitle === 'Add your first task') {
      const editable = projects.find((project) => project.role !== 'viewer');
      if (editable) navigate(`/project/${editable.id}`, { state: { createTask: true } });
      else setShowForm(true);
      return;
    }
    const owned = projects.find((project) => project.role === 'owner');
    if (owned) navigate(`/project/${owned.id}`, { state: { openTeam: true } });
    else toast.message('Ask a project owner to invite your teammates.');
  };

  if (loading) {
    return (
      <div className="app-page">
        <Navbar pageTitle="Dashboard" onSearch={setSearch} />
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
      <Navbar pageTitle="Dashboard" onSearch={setSearch} />

      <main className="page-container">
        <header className="page-header">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.13em] text-primary">Your workspace</p>
            <h1 className="page-heading">{getGreeting()}{firstName ? `, ${firstName}` : ''}</h1>
            <p className="mt-1 text-sm text-muted">
              {projects.length === 0 ? 'A clear place to make progress.' : `${projects.length} project${projects.length > 1 ? 's' : ''} in your workspace`}
            </p>
          </div>
          <Button onClick={() => setShowForm((shown) => !shown)}>
            <FolderPlus size={17} aria-hidden="true" />
            New project
          </Button>
        </header>

        {!onboardingDismissed && (
          <Card className="mb-6 p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">A quick start for your workspace</h2>
                <p className="mt-1 text-sm text-muted">A few small steps help your team get moving.</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Dismiss onboarding checklist" onClick={dismissOnboarding}>
                <X size={16} aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {onboardingItems.map((item) => {
                const StepIcon = item.complete ? Check : item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => !item.complete && followOnboardingStep(item.title)}
                    disabled={item.complete}
                    className={`flex items-center gap-2 rounded-xl border border-border p-3 text-left text-sm transition-colors ${item.complete ? 'bg-accent text-muted' : 'bg-surface hover:bg-accent'}`}
                  >
                    <StepIcon size={16} aria-hidden="true" />
                    <span className="flex-1">{item.title}</span>
                    <span className="sr-only">{item.complete ? 'Complete' : 'Not complete'}</span>
                  </button>
                );
              })}
            </div>
            {incompleteOnboarding.length === 0 && (
              <p className="mt-3 text-xs font-medium text-success">You’re all set — your workspace is ready.</p>
            )}
            {projects.length < projectCount && (
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" onClick={loadMoreProjects} disabled={loadingMoreProjects}>
                  {loadingMoreProjects ? 'Loading projects…' : 'Load more projects'}
                </Button>
              </div>
            )}
          </Card>
        )}

        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Workspace statistics">
          {[
            { title: 'Total projects', value: stats.total_projects, caption: 'Across your workspace', icon: FolderPlus },
            { title: 'Open tasks', value: stats.open_tasks, caption: 'Ready to move forward', icon: ListChecks },
            { title: 'Due this week', value: stats.due_this_week, caption: 'Keep an eye on these', icon: CalendarClock },
            { title: 'Completed this week', value: stats.completed_this_week, caption: 'A good week of progress', icon: Check },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Card key={stat.title} className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted sm:text-sm">{stat.title}</span>
                  <StatIcon size={16} className="shrink-0 text-primary" aria-hidden="true" />
                </div>
                <m.p
                  key={stat.value}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                  className="mt-2 text-2xl font-semibold tracking-tight"
                >
                  {stat.value}
                </m.p>
                <p className="mt-1 text-[0.7rem] text-muted">{stat.caption}</p>
              </Card>
            );
          })}
        </section>

        <details className="mb-8 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <summary className="cursor-pointer font-semibold focus-visible:rounded">Productivity insights <span className="ml-1 text-xs font-normal text-muted">(charts load when opened)</span></summary>
          <div className="mt-4" aria-label="Productivity insights">
            <Suspense fallback={<div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>}>
              <DashboardInsights
                completions={summary.completions}
                projects={summary.project_progress}
                reduceMotion={reduceMotion}
              />
            </Suspense>
          </div>
        </details>

        <section id="my-tasks" className="mb-8" aria-labelledby="my-tasks-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="my-tasks-heading" className="text-lg font-semibold">My tasks</h2>
              <p className="text-sm text-muted">Open tasks assigned to you across projects</p>
            </div>
          </div>
          {summary.my_tasks.length ? (
            <ul className="space-y-2">
              {summary.my_tasks.slice(0, 8).map((task) => (
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
                    <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>{task.priority || 'medium'}</Badge>
                    {task.due_date && <time className="hidden shrink-0 text-xs text-muted sm:block" dateTime={task.due_date}>{task.due_date}</time>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Tasks assigned to you will appear here.</p>
          )}
        </section>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <label className="sr-only" htmlFor="project-sort">Sort projects</label>
          <select id="project-sort" className="ui-input !min-h-11 sm:w-40" value={projectSort} onChange={(event) => setProjectSort(event.target.value)}>
            <option value="recent">Recently active</option>
            <option value="name">Name</option>
            <option value="progress">Progress</option>
          </select>
          <div className="flex rounded-xl border border-border p-1" role="group" aria-label="Project layout">
            <Button size="sm" variant={projectLayout === 'grid' ? 'primary' : 'ghost'} aria-label="Grid layout" aria-pressed={projectLayout === 'grid'} onClick={() => setProjectLayout('grid')}>Grid</Button>
            <Button size="sm" variant={projectLayout === 'list' ? 'primary' : 'ghost'} aria-label="List layout" aria-pressed={projectLayout === 'list'} onClick={() => setProjectLayout('list')}>List</Button>
          </div>
        </div>

        {showForm && (
          <Card as="form" onSubmit={handleCreateProject} className="mb-8 p-5">
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                Project template
                <select
                  className="ui-input"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                  aria-label="Choose a project template"
                >
                  {Object.entries(PROJECT_TEMPLATES).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <Button type="submit" disabled={creatingProject}>
              <FolderPlus size={16} aria-hidden="true" />
              {creatingProject ? 'Creating…' : 'Create project'}
            </Button>
          </Card>
        )}

        {projects.length === 0 && !search.trim() ? (
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
          <div className={projectLayout === 'grid' ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-3'}>
            {filteredProjects.map((project, index) => {
              const progress = summary.project_progress.find((item) => item.project_id === project.id);
              const activityAt = project.recent_activity_at
                ? formatDistanceToNow(new Date(project.recent_activity_at), { addSuffix: true })
                : 'No updates yet';
              return (
              <m.div
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
                className={`ui-card project-card group ${projectLayout === 'list' ? 'project-card-list' : ''}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl font-semibold ${CARD_COLORS[index % CARD_COLORS.length]}`}>
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  {project.role === 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => handleArchiveProject(event, project.id)}
                      aria-label={`Archive ${project.name}`}
                    >
                      <Archive size={15} aria-hidden="true" />
                      <span className="hidden sm:inline">Archive</span>
                    </Button>
                  )}
                </div>

                <h2 className="mb-1 font-semibold tracking-tight text-foreground">{project.name}</h2>
                <p className="mb-4 line-clamp-2 min-h-10 text-sm text-muted">
                  {project.description || 'Add a description'}
                </p>

                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>{progress ? `${progress.done} of ${progress.total} tasks complete` : 'No tasks yet'}</span>
                    <span>{progress?.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`${project.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.progress || 0}>
                    <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${progress?.progress || 0}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {project.is_shared
                      ? <Badge tone="warning">Shared with you · {project.role}</Badge>
                      : <Badge tone="primary">Project</Badge>}
                    {project.owner_display_name && project.is_shared && (
                      <span className="self-center text-xs text-muted">by {project.owner_display_name}</span>
                    )}
                    {project.member_count > 0 && <Badge tone="neutral"><Users size={12} aria-hidden="true" />{project.member_count} members</Badge>}
                  </div>
                  <span className="project-card-footer">
                    <span className="text-[0.68rem] text-muted">{activityAt}</span>
                    <span className="text-xs font-semibold text-primary">Open project <ArrowRight size={13} aria-hidden="true" /></span>
                  </span>
                </div>
              </m.div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;
