import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Circle, ListChecks, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import Navbar from '../components/Navbar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';

const STATUS_CONFIG = {
  todo: { label: 'To do', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'warning' },
  done: { label: 'Done', tone: 'success' },
};

const confettiColors = ['bg-primary', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'];

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [localProgress, setLocalProgress] = useState({});
  const [notFound, setNotFound] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const reduceMotion = useReducedMotion();

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/project/${id}`);
      setTasks(data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load tasks. Please try again.');
    }
  }, [id]);

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject(data);
      setNotFound(false);
      await fetchTasks();
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        toast.error(error.response?.data?.error || 'Unable to load project. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchTasks, id]);

  useEffect(() => {
    void Promise.resolve().then(fetchProject);
  }, [fetchProject]);

  const handleCreateTask = async (event) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    try {
      await api.post('/tasks', { title: trimmedTitle, project_id: id });
      setTitle('');
      toast.success('Task added');
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create task. Please try again.');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const wasCompleted = tasks.length > 0 && tasks.every(
      (task) => task.status === 'done' || task.id === taskId && newStatus === 'done',
    );

    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      if (wasCompleted && newStatus === 'done') {
        setShowConfetti(true);
        window.setTimeout(() => setShowConfetti(false), reduceMotion ? 0 : 850);
        toast.success('Project complete. Great work!');
      } else if (newStatus === 'done') {
        toast.success('Task completed');
      }
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update task. Please try again.');
    }
  };

  const handleProgressDrag = (taskId, value) => {
    setLocalProgress((previous) => ({ ...previous, [taskId]: value }));
  };

  const handleProgressCommit = async (taskId, value) => {
    try {
      await api.patch(`/tasks/${taskId}`, { progress: Number(value) });
      setLocalProgress((previous) => {
        const next = { ...previous };
        delete next[taskId];
        return next;
      });
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update task progress. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to delete task. Please try again.');
    }
  };

  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="app-page">
        <Navbar backTo="/dashboard" />
        <div className="page-container space-y-5" role="status" aria-label="Loading project">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-14 w-full" />
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="app-page">
        <Navbar backTo="/dashboard" />
        <main className="page-container">
          <EmptyState
            icon={ListChecks}
            title="Project not found"
            description="This project may have been deleted or you may not have access to it."
            action={
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <Navbar backTo="/dashboard" />

      <main className="page-container">
        <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Project</p>
            <h1 className="page-heading break-words">{project?.name}</h1>
            <p className="mt-1 text-sm text-muted">{project?.description || 'Keep the next step clear.'}</p>
          </div>
          {tasks.length > 0 && (
            <div className="w-full sm:w-56">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>
                  <motion.span
                    key={doneCount}
                    initial={reduceMotion ? false : { opacity: 0.6, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {doneCount}
                  </motion.span>
                  {' '}of {tasks.length} complete
                </span>
                <motion.span
                  key={progressPct}
                  initial={reduceMotion ? false : { opacity: 0.6, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {progressPct}%
                </motion.span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label="Project completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
              >
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </header>

        <form onSubmit={handleCreateTask} className="mb-6 flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            placeholder="Add a task..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
            aria-label="New task title"
          />
          <Button type="submit" disabled={!title.trim()} className="shrink-0">
            <Plus size={17} aria-hidden="true" />
            Add task
          </Button>
        </form>

        {tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Ready when you are"
            description="Add the first task to turn this project into a plan."
          />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {tasks.map((task, index) => {
                const currentProgress = task.status === 'done'
                  ? 100
                  : localProgress[task.id] ?? task.progress ?? 0;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.2) }}
                    className="ui-card relative overflow-hidden p-4 sm:px-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={task.status === 'done' ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted'}>
                        {task.status === 'done'
                          ? (
                            <motion.span
                              initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ duration: reduceMotion ? 0 : 0.18 }}
                              className="inline-flex"
                            >
                              <Check size={18} aria-label="Completed" />
                            </motion.span>
                          )
                          : <Circle size={18} aria-hidden="true" />}
                      </span>
                      <span className={`min-w-0 flex-1 text-sm font-medium ${task.status === 'done' ? 'text-muted line-through' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                      {(task.status === 'in_progress' || task.status === 'done') && (
                        <Badge tone={task.status === 'done' ? 'success' : 'warning'}>
                          {currentProgress}%
                        </Badge>
                      )}
                      <label className="sr-only" htmlFor={`task-status-${task.id}`}>Status for {task.title}</label>
                      <select
                        id={`task-status-${task.id}`}
                        value={task.status}
                        onChange={(event) => handleStatusChange(task.id, event.target.value)}
                        className="ui-input !min-h-9 w-auto min-w-32 py-1.5 text-xs font-semibold"
                      >
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <option key={value} value={value}>{config.label}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete task ${task.title}`}
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>

                    {task.status === 'in_progress' && (
                      <div className="mt-3 flex items-center gap-3 pl-8">
                        <label className="sr-only" htmlFor={`task-progress-${task.id}`}>
                          Progress for {task.title}
                        </label>
                        <input
                          id={`task-progress-${task.id}`}
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={currentProgress}
                          onChange={(event) => handleProgressDrag(task.id, event.target.value)}
                          onMouseUp={(event) => handleProgressCommit(task.id, event.currentTarget.value)}
                          onTouchEnd={(event) => handleProgressCommit(task.id, event.currentTarget.value)}
                          onKeyUp={(event) => handleProgressCommit(task.id, event.currentTarget.value)}
                          onBlur={(event) => handleProgressCommit(task.id, event.currentTarget.value)}
                          className="w-full accent-[var(--primary)]"
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        {showConfetti && (
          <div className="pointer-events-none fixed right-8 top-24 z-30 flex gap-2" aria-hidden="true">
            {confettiColors.map((color, dotIndex) => (
              <motion.span
                key={color}
                initial={{ opacity: 0, y: 9, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0], y: -26 - (dotIndex % 3) * 7, x: (dotIndex - 2) * 9, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' }}
                className={`h-2 w-2 rounded-full ${color}`}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
