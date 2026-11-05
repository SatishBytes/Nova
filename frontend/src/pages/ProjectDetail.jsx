import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { differenceInCalendarDays, endOfWeek, parseISO, startOfToday } from 'date-fns';
import {
  Archive,
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  Columns3,
  FolderKanban,
  List,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Signal,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import Navbar from '../components/Navbar';
import TaskCard from '../components/tasks/TaskCard';
import TeamPanel from '../components/TeamPanel';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import Tooltip from '../components/ui/Tooltip';
import Dropdown from '../components/ui/Dropdown';
import useTasks from '../hooks/useTasks';
import usePageTitle from '../hooks/usePageTitle';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/useAuth';

const COLUMNS = [
  { id: 'todo', label: 'To do', tone: 'neutral' },
  { id: 'in_progress', label: 'In progress', tone: 'warning' },
  { id: 'done', label: 'Done', tone: 'success' },
];

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };
const VIEW_STORAGE_KEY = 'nova-project-view';
const AI_TASKS_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';
const LazyTaskDetailsPanel = lazy(() => import('../components/tasks/TaskDetailsPanel'));
const AISuggestionsDialog = lazy(() => import('../components/tasks/AISuggestionsDialog'));

const sortTasks = (tasks, sort) => {
  const result = [...tasks];
  if (sort === 'due') {
    result.sort((left, right) => (
      (left.due_date ? parseISO(left.due_date).getTime() : Number.MAX_SAFE_INTEGER)
      - (right.due_date ? parseISO(right.due_date).getTime() : Number.MAX_SAFE_INTEGER)
    ));
  } else if (sort === 'priority') {
    result.sort((left, right) => (
      (PRIORITY_ORDER[left.priority] ?? 2) - (PRIORITY_ORDER[right.priority] ?? 2)
    ));
  } else if (sort === 'newest') {
    result.sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0));
  } else {
    result.sort((left, right) => (left.position || 0) - (right.position || 0));
  }
  return result;
};

const isDueFilterMatch = (task, filter) => {
  if (!filter) return true;
  if (filter === 'no_date') return !task.due_date;
  if (!task.due_date || task.status === 'done') return false;
  const difference = differenceInCalendarDays(parseISO(task.due_date), startOfToday());
  if (filter === 'overdue') return difference < 0;
  return difference >= 0 && parseISO(task.due_date) <= endOfWeek(new Date(), { weekStartsOn: 1 });
};

const BoardColumn = ({
  column,
  tasks,
  draggable,
  canEdit,
  onOpen,
  onStatusChange,
  onCreate,
  focusNewTask,
  onFocusTaskComplete,
}) => {
  const reduceMotion = useReducedMotion();
  const { isOver, setNodeRef } = useDroppable({ id: `column:${column.id}` });
  const [title, setTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const taskInputRef = useRef(null);

  useEffect(() => {
    if (!focusNewTask) return;
    taskInputRef.current?.focus();
    onFocusTaskComplete();
  }, [focusNewTask, onFocusTaskComplete]);

  const submitTask = async (event) => {
    event.preventDefault();
    const taskTitle = title.trim();
    if (!taskTitle || savingTask) return;
    setSavingTask(true);
    try {
      await onCreate(column.id, taskTitle);
      setTitle('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create task.');
    } finally {
      setSavingTask(false);
    }
  };

  return (
    <section className="board-column min-w-0" aria-labelledby={`column-heading-${column.id}`}>
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <h2 id={`column-heading-${column.id}`} className="flex items-center gap-2 text-sm font-semibold">
          <span className={`status-dot status-dot-${column.id}`} aria-hidden="true" />
          {column.label}
          <Badge tone={column.tone}>{tasks.length}</Badge>
        </h2>
        <div className="flex items-center gap-1">
          <span className="sr-only">{tasks.length} tasks</span>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="column-add-button"
              aria-label={`Add task to ${column.label}`}
              onClick={() => taskInputRef.current?.focus()}
            >
              <Plus size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`board-column-dropzone space-y-3 rounded-xl p-1 transition-colors ${isOver ? 'bg-accent' : ''}`}
          aria-label={`${column.label} tasks`}
        >
          <AnimatePresence initial={false}>
            {tasks.map((task, index) => (
              <m.div
                key={task.id}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.12) }}
              >
                <TaskCard
                  task={task}
                  draggable={draggable}
                  canEdit={canEdit}
                  onOpen={onOpen}
                  onStatusChange={onStatusChange}
                />
              </m.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted">
              No tasks here yet
            </p>
          )}
        </div>
      </SortableContext>
      {canEdit && (
        <form onSubmit={submitTask} className="mt-3 flex gap-2">
          <Input
            ref={taskInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task..."
            maxLength={100}
            aria-label={`New task in ${column.label}`}
            className="!min-h-10"
          />
          <Tooltip label="Press N to focus the task title field.">
            <Button type="submit" variant="secondary" size="icon" aria-label={`Add task to ${column.label}`} disabled={!title.trim() || savingTask}>
              <Plus size={17} aria-hidden="true" />
            </Button>
          </Tooltip>
        </form>
      )}
    </section>
  );
};

const ProjectActivity = ({ activity, onLoadMore, hasMore, loadingMore }) => (
  <section className="activity-panel" aria-labelledby="activity-heading">
    <header className="mb-4">
      <h2 id="activity-heading" className="text-lg font-semibold">Project activity</h2>
      <p className="mt-1 text-sm text-muted">Recent updates from your team.</p>
    </header>
    {activity.length === 0 ? (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Updates from your team will appear here.</p>
    ) : (
      <ol className="space-y-2">
        {activity.map((entry) => {
          const actorName = entry.actor?.display_name || entry.actor?.email || 'A teammate';
          const taskTitle = entry.meta?.title || entry.meta?.task_title;
          let message = `${actorName} ${entry.action.replaceAll('_', ' ')} ${entry.entity_type.replaceAll('_', ' ')}`;
          if (entry.action === 'moved') {
            message = `${actorName} moved "${taskTitle || 'a task'}" from ${entry.meta?.from_status?.replace('_', ' ') || 'a column'} to ${entry.meta?.to_status?.replace('_', ' ') || 'a column'}`;
          } else if (entry.action === 'created') {
            message = `${actorName} created "${taskTitle || 'a task'}"`;
          } else if (entry.action === 'commented') {
            message = `${actorName} commented on "${taskTitle || 'a task'}"`;
          } else if (entry.action === 'invited') {
            message = `${actorName} invited ${entry.meta?.email || 'a teammate'}`;
          } else if (entry.action === 'role_changed') {
            message = `${actorName} changed a team member's role to ${entry.meta?.to_role || 'a new role'}`;
          } else if (entry.action === 'member_removed' || entry.action === 'member_left') {
            message = `${actorName} ${entry.action === 'member_left' ? 'left the project' : `removed ${entry.meta?.email || 'a member'}`}`;
          }
          return (
            <li key={entry.id} className="activity-item">
              <Avatar
                name={entry.actor?.display_name || entry.actor?.email}
                email={entry.actor?.email}
                color={entry.actor?.avatar_color}
                className="!h-7 !w-7 !text-[0.62rem]"
              />
              <span className="min-w-0 flex-1 text-sm">{message}</span>
              <time className="shrink-0 text-xs text-muted" dateTime={entry.created_at}>
                {new Date(entry.created_at).toLocaleString()}
              </time>
            </li>
          );
        })}
      </ol>
    )}
    {hasMore && (
      <div className="mt-4 flex justify-center">
        <Button variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading activity…' : 'Load more activity'}
        </Button>
      </div>
    )}
  </section>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const {
    tasks,
    loading: tasksLoading,
    fetchTasks,
    loadMoreTasks,
    hasMoreTasks,
    loadingMoreTasks,
    createTask,
    updateTask,
    moveTask,
    deleteTaskWithUndo,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  } = useTasks(id);
  const [project, setProject] = useState(null);
  usePageTitle(project?.name || 'Project');
  const [projectLoading, setProjectLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const [commentsRealtimeKey, setCommentsRealtimeKey] = useState(0);
  const [editingProject, setEditingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ name: '', description: '' });
  const [focusNewTask, setFocusNewTask] = useState(false);
  const [listTaskTitle, setListTaskTitle] = useState('');
  const [creatingListTask, setCreatingListTask] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [view, setView] = useState(() => {
    try {
      return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'board';
    } catch {
      return 'board';
    }
  });
  const [projectTab, setProjectTab] = useState(view);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [dueFilter, setDueFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sort, setSort] = useState('manual');
  const [draggedTask, setDraggedTask] = useState(null);
  const [confetti, setConfetti] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      setProject((current) => ({ ...current, ...data }));
      setProjectDraft({ name: data.name || '', description: data.description || '' });
      setNotFound(false);
      setProjectError('');
    } catch (error) {
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        const message = error.response?.data?.error || 'Unable to load project.';
        setProjectError(message);
        toast.error(message);
      }
    } finally {
      setProjectLoading(false);
    }
  }, [id]);

  const fetchTeam = useCallback(async () => {
    try {
      const { data } = await api.get(`/team/project/${id}`);
      setTeamMembers(data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load project team.');
    }
  }, [id]);

  const fetchActivity = useCallback(async (offset = 0, append = false) => {
    try {
      const { data, headers } = await api.get(`/projects/${id}/activity`, { params: { limit: 50, offset } });
      setActivity((current) => append ? [...current, ...data] : data);
      const total = Number(headers?.['x-total-count'] || offset + data.length);
      setActivityHasMore(total > offset + data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load project activity.');
    }
  }, [id]);

  const loadMoreActivity = async () => {
    if (activityLoadingMore || !activityHasMore) return;
    setActivityLoadingMore(true);
    try {
      await fetchActivity(activity.length, true);
    } finally {
      setActivityLoadingMore(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchProject);
  }, [fetchProject]);

  useEffect(() => {
    if (!location.state?.createTask && !location.state?.openTeam) return;
    void Promise.resolve().then(() => {
      if (location.state.createTask) {
        setView('board');
        setProjectTab('board');
        setFocusNewTask(true);
      }
      if (location.state.openTeam) setTeamOpen(true);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    });
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const handleCreateTaskShortcut = () => {
      if (project?.role === 'owner' || project?.role === 'member') {
        setView('board');
        setProjectTab('board');
        setFocusNewTask(true);
      } else {
        toast.error('You do not have permission to create tasks in this project.');
      }
    };
    window.addEventListener('nova:create-task', handleCreateTaskShortcut);
    return () => window.removeEventListener('nova:create-task', handleCreateTaskShortcut);
  }, [project?.role]);

  useEffect(() => {
    if (!project) return;
    void Promise.resolve().then(fetchTeam);
    void Promise.resolve().then(fetchActivity);
  }, [fetchActivity, fetchTeam, project]);

  useEffect(() => {
    const channel = supabase
      .channel(`project-collaboration-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${id}`,
      }, () => {
        void fetchTasks();
        void fetchActivity();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'comments',
      }, () => {
        setCommentsRealtimeKey((current) => current + 1);
        void fetchActivity();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_log',
        filter: `project_id=eq.${id}`,
      }, () => {
        void fetchActivity();
      })
      .subscribe((status) => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'live' : 'reconnecting');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchActivity, fetchTasks, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      toast.error('Unable to remember your preferred board view.');
    }
  }, [view]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labels = useMemo(() => (
    [...new Set(tasks.flatMap((task) => task.labels || []))].sort((a, b) => a.localeCompare(b))
  ), [tasks]);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (debouncedSearch && !`${task.title} ${task.description || ''} ${(task.labels || []).join(' ')}`.toLowerCase().includes(debouncedSearch)) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (labelFilter && !(task.labels || []).includes(labelFilter)) return false;
      if (assigneeFilter && task.assignee_id !== assigneeFilter) return false;
      return isDueFilterMatch(task, dueFilter);
    });
    return sortTasks(filtered, sort);
  }, [assigneeFilter, debouncedSearch, dueFilter, labelFilter, priorityFilter, sort, tasks]);

  const activeTaskId = searchParams.get('task');
  const activeTask = tasks.find((task) => task.id === activeTaskId) || null;
  const doneCount = tasks.filter((task) => task.status === 'done').length;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const canEdit = project?.role === 'owner' || project?.role === 'member';
  const canManageTeam = project?.role === 'owner';
  const dragEnabled = sort === 'manual' && canEdit;
  const completeTaskInputFocus = useCallback(() => setFocusNewTask(false), []);
  const focusAddTask = () => {
    if (!canEdit) return;
    setView('board');
    setProjectTab('board');
    setFocusNewTask(true);
  };

  const openTask = (taskId) => {
    const next = new URLSearchParams(searchParams);
    next.set('task', taskId);
    setSearchParams(next);
  };

  const closeTask = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleCreateTask = async (status, title) => {
    await createTask({ title, status });
    toast.success('Task added');
  };

  const handleCreateListTask = async (event) => {
    event.preventDefault();
    const title = listTaskTitle.trim();
    if (!title || !canEdit || creatingListTask) return;
    setCreatingListTask(true);
    try {
      await handleCreateTask('todo', title);
      setListTaskTitle('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to create task.');
    } finally {
      setCreatingListTask(false);
    }
  };

  const handleStatusChange = (task, status) => {
    if (!canEdit) return;
    const isLastTask = status === 'done'
      && tasks.length > 0
      && tasks.every((item) => item.status === 'done' || item.id === task.id);
    const position = tasks.filter((item) => item.status === status && item.id !== task.id).length;
    moveTask(task.id, status, position);
    if (isLastTask) {
      setConfetti(true);
      window.setTimeout(() => setConfetti(false), reduceMotion ? 0 : 850);
      toast.success('Project complete. Great work!');
    } else if (status === 'done') {
      toast.success('Task completed');
    }
  };

  const saveProject = async (event) => {
    event.preventDefault();
    const name = projectDraft.name.trim();
    if (!name || name.length > 100 || projectDraft.description.length > 500) {
      toast.error('Project name is required and descriptions must be 500 characters or fewer.');
      return;
    }
    try {
      const { data } = await api.patch(`/projects/${id}`, {
        name,
        description: projectDraft.description.trim(),
      });
      setProject((current) => ({ ...current, ...data }));
      setEditingProject(false);
      toast.success('Project details saved');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to save project details.');
    }
  };

  const archiveProject = async () => {
    if (project.role !== 'owner' || !window.confirm(`Archive "${project.name}"? You can restore it later from the dashboard.`)) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('Project archived');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to archive project.');
    }
  };

  const handleDeleteTask = (taskId) => {
    deleteTaskWithUndo(taskId);
    closeTask();
  };

  const generateTaskSuggestions = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post('/ai/generate-tasks', {
        project_id: id,
        description: project.description || '',
      });
      setAiSuggestions(data.tasks);
      setAiOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to generate task suggestions.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveSuggestedTasks = async () => {
    const titles = aiSuggestions.map((title) => title.trim()).filter(Boolean);
    if (!titles.length) {
      toast.error('Add at least one task title before saving.');
      return;
    }
    setAiSaving(true);
    let saved = 0;
    let failed = false;
    try {
      for (const title of titles) {
        if (title.length > 100) {
          toast.error('Task titles must be 100 characters or fewer.');
          failed = true;
          break;
        }
        try {
          await createTask({ title, status: 'todo' });
          saved += 1;
        } catch (error) {
          toast.error(error.response?.data?.error || 'Unable to save a suggested task.');
          failed = true;
          break;
        }
      }
      if (!failed && saved === titles.length) {
        setAiOpen(false);
        setAiSuggestions([]);
        toast.success(`${saved} task${saved === 1 ? '' : 's'} added`);
      } else {
        setAiSuggestions(titles.slice(saved));
        if (saved > 0) {
          toast.message(`${saved} task${saved === 1 ? '' : 's'} added. The remaining suggestions are still available.`);
        }
      }
    } finally {
      setAiSaving(false);
    }
  };

  const saveTaskChanges = useCallback((updates) => {
    if (!activeTaskId) return Promise.resolve();
    return updateTask(activeTaskId, updates);
  }, [activeTaskId, updateTask]);

  const addTaskSubtask = useCallback((title) => {
    if (!activeTaskId) return Promise.resolve();
    return createSubtask(activeTaskId, title);
  }, [activeTaskId, createSubtask]);

  const updateTaskSubtask = useCallback((subtaskId, updates) => {
    if (!activeTaskId) return Promise.resolve();
    return updateSubtask(activeTaskId, subtaskId, updates);
  }, [activeTaskId, updateSubtask]);

  const removeTaskSubtask = useCallback((subtaskId) => {
    if (!activeTaskId) return Promise.resolve();
    return deleteSubtask(activeTaskId, subtaskId);
  }, [activeTaskId, deleteSubtask]);

  const handleDragStart = ({ active }) => {
    setDraggedTask(tasks.find((task) => task.id === active.id) || null);
  };

  const handleDragEnd = ({ active, over }) => {
    setDraggedTask(null);
    if (!over || !dragEnabled || active.id === over.id) return;
    const movingTask = tasks.find((task) => task.id === active.id);
    if (!movingTask) return;

    const overId = String(over.id);
    const targetStatus = overId.startsWith('column:')
      ? overId.slice('column:'.length)
      : tasks.find((task) => task.id === over.id)?.status;
    if (!targetStatus) return;

    const remainingTarget = tasks
      .filter((task) => task.status === targetStatus && task.id !== movingTask.id)
      .sort((left, right) => (left.position || 0) - (right.position || 0));
    const targetIndex = overId.startsWith('column:')
      ? remainingTarget.length
      : Math.max(0, remainingTarget.findIndex((task) => task.id === over.id));
    moveTask(movingTask.id, targetStatus, targetIndex);
  };

  const handleDragCancel = () => setDraggedTask(null);

  const retryProjectLoad = () => {
    setProjectLoading(true);
    setProjectError('');
    void fetchProject();
  };

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('');
    setLabelFilter('');
    setDueFilter('');
    setAssigneeFilter('');
  };

  const setFilter = (key, value) => {
    if (key === 'priority') setPriorityFilter(value);
    if (key === 'label') setLabelFilter(value);
    if (key === 'due') setDueFilter(value);
    if (key === 'assignee') setAssigneeFilter(value);
  };

  const filterChips = [
    ...(priorityFilter ? [{ key: 'priority', label: `Priority: ${priorityFilter}` }] : []),
    ...(labelFilter ? [{ key: 'label', label: `Label: ${labelFilter}` }] : []),
    ...(dueFilter ? [{ key: 'due', label: `Due: ${dueFilter.replace('_', ' ')}` }] : []),
    ...(assigneeFilter ? [{ key: 'assignee', label: `Assignee: ${teamMembers.find((member) => member.user_id === assigneeFilter)?.profile?.display_name || teamMembers.find((member) => member.user_id === assigneeFilter)?.email || 'Member'}` }] : []),
  ];

  if (projectLoading || tasksLoading) {
    return (
      <div className="app-page">
        <Navbar pageTitle={project?.name || 'Project'} />
        <main className="page-container space-y-5" role="status" aria-label="Loading project">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-2 w-full" />
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-[26rem]" />)}
          </div>
        </main>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="app-page">
        <Navbar pageTitle={project?.name || 'Project'} />
        <main className="page-container">
          <EmptyState
            icon={ListChecks}
            title="Couldn't load this project"
            description={projectError}
            action={<Button variant="secondary" onClick={retryProjectLoad}>Try again</Button>}
          />
        </main>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="app-page">
        <Navbar />
        <main className="page-container">
          <EmptyState
            icon={ListChecks}
            title="Project not found"
            description="This project may have been deleted or you may not have access to it."
            action={<Button variant="secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-page">
      <Navbar pageTitle={project.name} />
      <main className="page-container">
        <header className="project-page-header">
          <div className="min-w-0 flex-1">
            <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <FolderKanban size={14} aria-hidden="true" /> Project
            </p>
            {!editingProject ? (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="page-heading break-words">{project.name}</h1>
                  {canManageTeam && (
                    <Button variant="ghost" size="icon" aria-label="Edit project details" onClick={() => setEditingProject(true)}>
                      <Pencil size={15} aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <p className={`mt-1 whitespace-pre-wrap text-sm ${project.description ? 'text-muted' : 'text-primary'}`}>
                  {project.description || (canManageTeam ? 'Add a description' : 'No description')}
                </p>
                <div className="project-header-meta">
                  <Badge tone={project.role === 'owner' ? 'primary' : project.role === 'member' ? 'success' : 'neutral'}>
                    {project.role === 'owner' ? 'Owner' : project.role === 'member' ? 'Member' : 'Viewer'}
                  </Badge>
                  <Badge tone={realtimeStatus === 'live' ? 'success' : 'warning'}>
                    <Signal size={13} aria-hidden="true" />
                    {realtimeStatus === 'live' ? 'Live updates on' : 'Reconnecting'}
                  </Badge>
                </div>
              </>
            ) : (
              <form onSubmit={saveProject} className="mt-2 grid max-w-2xl gap-2">
                <Input
                  value={projectDraft.name}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))}
                  maxLength={100}
                  aria-label="Project name"
                  autoFocus
                />
                <textarea
                  className="ui-input min-h-20"
                  value={projectDraft.description}
                  onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))}
                  maxLength={500}
                  aria-label="Project description"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm"><Check size={15} aria-hidden="true" />Save</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => {
                    setProjectDraft({ name: project.name || '', description: project.description || '' });
                    setEditingProject(false);
                  }}>Cancel</Button>
                </div>
              </form>
            )}
          </div>

          <div className="project-header-actions">
            <Button
              variant="secondary"
              size="sm"
              className="project-members-button"
              onClick={() => setTeamOpen(true)}
              aria-label={`Open team, ${teamMembers.length} members`}
            >
              <span className="avatar-stack" aria-hidden="true">
                {teamMembers.slice(0, 3).map((member) => (
                  <Avatar
                    key={member.user_id}
                    name={member.profile?.display_name || member.email}
                    email={member.email}
                    color={member.profile?.avatar_color}
                    className="!h-6 !w-6 !text-[0.58rem]"
                  />
                ))}
                {teamMembers.length > 3 && <span className="avatar-stack-more">+{teamMembers.length - 3}</span>}
              </span>
              <Users size={15} aria-hidden="true" /> Team
            </Button>
            {canEdit && <Button onClick={focusAddTask}><Plus size={16} aria-hidden="true" />Add task</Button>}
            {canManageTeam && (
              <Dropdown label="Project options" trigger={<MoreHorizontal size={19} aria-hidden="true" />}>
                <button type="button" role="menuitem" onClick={() => {
                  setProjectDraft({ name: project.name || '', description: project.description || '' });
                  setEditingProject(true);
                }}>
                  <Pencil size={15} aria-hidden="true" /> Edit project details
                </button>
                <button type="button" role="menuitem" className="menu-danger" onClick={archiveProject}>
                  <Archive size={15} aria-hidden="true" /> Archive project
                </button>
                {AI_TASKS_ENABLED && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { void generateTaskSuggestions(); }}
                    disabled={aiLoading || !project.description?.trim()}
                  >
                    <Sparkles size={15} aria-hidden="true" /> {aiLoading ? 'Generating suggestions…' : 'Suggest tasks'}
                  </button>
                )}
              </Dropdown>
            )}
          </div>
        </header>

        <section className="project-stats-strip" aria-label="Project progress">
          <div className="project-stats-summary">
            <span className="project-stats-count">{doneCount} <span>of {tasks.length} complete</span></span>
            <m.span key={progress} initial={reduceMotion ? false : { opacity: 0.6, y: 2 }} animate={{ opacity: 1, y: 0 }} className="project-stats-percent">{progress}%</m.span>
          </div>
          <div className="project-segmented-progress" role="progressbar" aria-label="Project completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            {COLUMNS.map((column) => {
              const count = tasks.filter((task) => task.status === column.id).length;
              return <span key={column.id} className={`project-progress-${column.id}`} style={{ width: `${tasks.length ? (count / tasks.length) * 100 : 0}%` }} title={`${column.label}: ${count}`} />;
            })}
          </div>
          <div className="project-stats-legend">
            {COLUMNS.map((column) => (
              <span key={column.id}><i className={`status-dot status-dot-${column.id}`} aria-hidden="true" />{column.label} <strong>{tasks.filter((task) => task.status === column.id).length}</strong></span>
            ))}
          </div>
        </section>

        <section className="project-toolbar" aria-label="Task filters and view options">
          <div className="project-toolbar-main">
            <label className="project-search">
              <span className="sr-only">Search tasks</span>
              <Search size={16} aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." />
            </label>
            <details className="filter-popover">
              <summary className="ui-button button-secondary button-sm">
                <SlidersHorizontal size={15} aria-hidden="true" />
                Filters
                {(filterChips.length + (search.trim() ? 1 : 0)) > 0 && <span className="filter-count">{filterChips.length + (search.trim() ? 1 : 0)}</span>}
              </summary>
              <div className="filter-popover-panel">
                <label>
                  <span>Priority</span>
                  <select className="ui-input" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Filter by priority">
                    <option value="">All priorities</option>
                    {['urgent', 'high', 'medium', 'low'].map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
                  </select>
                </label>
                <label>
                  <span>Label</span>
                  <select className="ui-input" value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} aria-label="Filter by label">
                    <option value="">All labels</option>
                    {labels.map((label) => <option key={label} value={label}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Due date</span>
                  <select className="ui-input" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} aria-label="Filter by due date">
                    <option value="">Any due date</option>
                    <option value="overdue">Overdue</option>
                    <option value="this_week">Due this week</option>
                    <option value="no_date">No due date</option>
                  </select>
                </label>
                <label>
                  <span>Assignee</span>
                  <select className="ui-input" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Filter by assignee">
                    <option value="">Anyone</option>
                    {teamMembers.filter((member) => member.user_id).map((member) => (
                      <option key={member.user_id} value={member.user_id}>{member.profile?.display_name || member.email || 'Project member'}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <label className="project-sort">
              <span className="sr-only">Sort tasks</span>
              <ArrowDownWideNarrow size={15} aria-hidden="true" />
              <select className="ui-input" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort tasks">
                <option value="manual">Manual</option>
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <div className="project-view-tabs" role="tablist" aria-label="Project views">
              <Button role="tab" aria-selected={projectTab === 'board'} variant={projectTab === 'board' ? 'primary' : 'ghost'} size="sm" onClick={() => { setView('board'); setProjectTab('board'); }}>
                <Columns3 size={15} aria-hidden="true" /> Board
              </Button>
              <Button role="tab" aria-selected={projectTab === 'list'} variant={projectTab === 'list' ? 'primary' : 'ghost'} size="sm" onClick={() => { setView('list'); setProjectTab('list'); }}>
                <List size={15} aria-hidden="true" /> List
              </Button>
              <Button role="tab" aria-selected={projectTab === 'activity'} variant={projectTab === 'activity' ? 'primary' : 'ghost'} size="sm" onClick={() => setProjectTab('activity')}>
                Activity
              </Button>
            </div>
          </div>

          {(filterChips.length > 0 || search.trim()) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                <SlidersHorizontal size={13} aria-hidden="true" /> Active filters
              </span>
              {search.trim() && (
                <button type="button" className="filter-chip" onClick={() => setSearch('')} aria-label="Clear search filter">
                  <Badge tone="neutral">Search: {search.trim()} ×</Badge>
                </button>
              )}
              {filterChips.map((chip) => (
                <button key={chip.key} type="button" onClick={() => setFilter(chip.key, '')} className="rounded-full">
                  <Badge tone="primary">{chip.label} ×</Badge>
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
            </div>
          )}
        </section>

        {projectTab === 'activity' ? (
          <ProjectActivity
            activity={activity}
            onLoadMore={loadMoreActivity}
            hasMore={activityHasMore}
            loadingMore={activityLoadingMore}
          />
        ) : (
          <>
            {tasks.length > 0 && filteredTasks.length === 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3" role="status">
                <p className="text-sm text-muted">No tasks match your filters.</p>
                <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            )}
            {view === 'board' ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                accessibility={{
                  announcements: {
                    onDragStart: ({ active }) => `Picked up task ${tasks.find((task) => task.id === active.id)?.title || ''}.`,
                    onDragOver: ({ active, over }) => over
                      ? `Task ${tasks.find((task) => task.id === active.id)?.title || ''} is over ${tasks.find((task) => task.id === over.id)?.title || String(over.id).replace('column:', '')}.`
                      : `Task ${tasks.find((task) => task.id === active.id)?.title || ''} is no longer over a drop target.`,
                    onDragEnd: ({ active, over }) => over
                      ? `Dropped task ${tasks.find((task) => task.id === active.id)?.title || ''}.`
                      : `Cancelled moving task ${tasks.find((task) => task.id === active.id)?.title || ''}.`,
                    onDragCancel: ({ active }) => `Cancelled moving task ${tasks.find((task) => task.id === active.id)?.title || ''}.`,
                  },
                  screenReaderInstructions: {
                    draggable: 'To move a task, press Space, use the arrow keys to choose a destination, then press Space again. Press Escape to cancel.',
                  },
                }}
              >
                {!dragEnabled && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                    <Tooltip label="Choose Manual order to drag and reorder tasks.">
                      <span tabIndex={0} className="inline-flex items-center gap-1 rounded px-1 py-0.5">
                        <SlidersHorizontal size={14} aria-hidden="true" />
                        Dragging is disabled while a custom sort is active.
                      </span>
                    </Tooltip>
                  </div>
                )}
                <div className="board-scroll">
                  {COLUMNS.map((column) => (
                    <BoardColumn
                      key={column.id}
                      column={column}
                      tasks={filteredTasks.filter((task) => task.status === column.id)}
                      draggable={dragEnabled}
                      canEdit={canEdit}
                      onOpen={openTask}
                      onStatusChange={handleStatusChange}
                      onCreate={handleCreateTask}
                      focusNewTask={column.id === 'todo' && focusNewTask}
                      onFocusTaskComplete={completeTaskInputFocus}
                    />
                  ))}
                </div>
                <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
                  {draggedTask ? <TaskCard task={draggedTask} overlay canEdit={canEdit} onOpen={() => {}} onStatusChange={() => {}} /> : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {canEdit && (
                  <form onSubmit={handleCreateListTask} className="mb-3 flex gap-2">
                    <Input
                      value={listTaskTitle}
                      onChange={(event) => setListTaskTitle(event.target.value)}
                      placeholder="Add a task..."
                      maxLength={100}
                      aria-label="New task"
                      className="!min-h-10"
                    />
                    <Button type="submit" variant="secondary" aria-label="Add task" disabled={!listTaskTitle.trim() || creatingListTask}>
                      <Plus size={17} aria-hidden="true" />
                      <span className="hidden sm:inline">Add task</span>
                    </Button>
                  </form>
                )}
                {filteredTasks.length === 0 && tasks.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
                    No tasks yet. Add one above to get started.
                  </p>
                )}
                <div role="list" aria-label="Tasks" className="space-y-2">
                  <AnimatePresence initial={false}>
                    {filteredTasks.map((task, index) => (
                      <m.div
                        key={task.id}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : Math.min(index * 0.015, 0.12) }}
                        className="ui-card grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:px-4"
                        role="listitem"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            title={task.title}
                            className={`task-title-button line-clamp-2 text-left text-sm font-semibold ${task.status === 'done' ? 'text-muted line-through' : 'text-foreground'}`}
                            onClick={() => openTask(task.id)}
                          >
                            {task.title}
                          </button>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge tone={task.priority === 'urgent' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>{task.priority || 'medium'}</Badge>
                            {(task.labels || []).map((label) => <Badge key={label} tone="neutral">{label}</Badge>)}
                            {task.due_date && <Badge tone="neutral"><CalendarDays size={13} aria-hidden="true" />{task.due_date}</Badge>}
                          </div>
                          {task.status === 'in_progress' && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-label={`Progress for ${task.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress || 0}>
                                <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress || 0}%` }} />
                              </div>
                              <span className="text-[0.7rem] text-muted">{task.progress || 0}%</span>
                            </div>
                          )}
                        </div>
                        <Avatar name={task.assignee?.display_name || task.assignee?.email || 'Unassigned'} color={task.assignee?.avatar_color} className="!h-7 !w-7 !text-[0.65rem]" />
                        <label className="sr-only" htmlFor={`list-status-${task.id}`}>Status for {task.title}</label>
                        <select
                          id={`list-status-${task.id}`}
                          className="ui-input !min-h-9 w-full py-1.5 text-xs sm:w-36"
                          value={task.status}
                          onChange={(event) => handleStatusChange(task, event.target.value)}
                          disabled={!canEdit}
                        >
                          {COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
                        </select>
                        <span className="text-right text-xs text-muted sm:min-w-24">
                          {task.status === 'in_progress' ? `${task.progress || 0}% complete` : `${task.subtask_counts?.done || 0}/${task.subtask_counts?.total || 0} subtasks`}
                        </span>
                      </m.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {hasMoreTasks && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={loadMoreTasks} disabled={loadingMoreTasks}>
                  {loadingMoreTasks ? 'Loading tasks…' : 'Load more tasks'}
                </Button>
              </div>
            )}
          </>
        )}

        {confetti && (
          <div className="pointer-events-none fixed right-8 top-24 z-30 flex gap-2" aria-hidden="true">
            {['bg-primary', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500'].map((color, index) => (
              <m.span
                key={color}
                initial={{ opacity: 0, y: 9, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0], y: -26 - (index % 3) * 7, x: (index - 2) * 9, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.7, ease: 'easeOut' }}
                className={`h-2 w-2 rounded-full ${color}`}
              />
            ))}
          </div>
        )}

        {activeTask && (
          <Suspense fallback={<div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-border bg-surface p-5"><Skeleton className="h-full" /></div>}>
          <LazyTaskDetailsPanel
            key={activeTask.id}
            task={activeTask}
            onClose={closeTask}
            onSave={saveTaskChanges}
            onDelete={() => handleDeleteTask(activeTask.id)}
            onCreateSubtask={addTaskSubtask}
            onUpdateSubtask={updateTaskSubtask}
            onDeleteSubtask={removeTaskSubtask}
            teamMembers={teamMembers}
            canEdit={canEdit}
            realtimeKey={commentsRealtimeKey}
          />
          </Suspense>
        )}

        {aiOpen && (
          <Suspense fallback={null}>
            <AISuggestionsDialog
              open={aiOpen}
              onClose={() => setAiOpen(false)}
              suggestions={aiSuggestions}
              onSuggestionsChange={setAiSuggestions}
              onSave={saveSuggestedTasks}
              saving={aiSaving}
            />
          </Suspense>
        )}

        <TeamPanel
          projectId={id}
          open={teamOpen}
          onClose={() => {
            setTeamOpen(false);
            if (user?.id) void fetchTeam();
          }}
          role={project.role}
          userId={user?.id}
        />
      </main>
    </div>
  );
};

export default ProjectDetail;
