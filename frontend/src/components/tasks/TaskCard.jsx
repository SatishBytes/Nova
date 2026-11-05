import { m, useReducedMotion } from 'motion/react';
import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  Check,
  Circle,
  GripVertical,
  ListChecks,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

const PRIORITY = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'primary' },
  high: { label: 'High', tone: 'warning' },
  urgent: { label: 'Urgent', tone: 'danger' },
};

const getDueLabel = (dueDate, status) => {
  if (!dueDate) return null;
  const date = parseISO(dueDate);
  const days = differenceInCalendarDays(date, startOfToday());
  if (status !== 'done' && days < 0) {
    const overdueDays = Math.abs(days);
    return {
      label: `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} overdue`,
      icon: AlertCircle,
      tone: 'danger',
    };
  }
  if (days === 0) return { label: 'Due today', icon: CalendarClock, tone: 'warning' };
  if (days === 1) return { label: 'Due tomorrow', icon: CalendarClock, tone: 'warning' };
  if (days === 2) return { label: 'Due in 2 days', icon: CalendarClock, tone: 'warning' };
  return { label: `Due ${format(date, 'MMM d')}`, icon: CalendarDays, tone: 'neutral' };
};

const TaskCard = ({ task, draggable = true, canEdit = true, onOpen, onStatusChange, overlay = false }) => {
  const reduceMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: overlay ? `overlay-${task.id}` : task.id, disabled: !draggable || overlay });
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const due = getDueLabel(task.due_date, task.status);
  const DueIcon = due?.icon;
  const counts = task.subtask_counts || { done: 0, total: 0 };

  return (
    <m.article
      ref={setNodeRef}
      layout={reduceMotion ? false : true}
      style={{
        transform: overlay ? undefined : CSS.Transform.toString(transform),
        transition: overlay ? undefined : transition,
      }}
      className={`ui-card task-card p-3.5 ${isDragging && !overlay ? 'opacity-40' : ''} ${overlay ? 'rotate-1 shadow-xl' : ''}`}
    >
      <div className="flex items-start gap-2">
        {!overlay && (
          <Button
            variant="ghost"
            size="icon"
            className="task-drag-handle -ml-1 -mt-1 h-8 w-8 shrink-0"
            aria-label={`Drag task ${task.title}`}
            title={draggable ? 'Drag to reorder' : 'Change sort to manual to reorder tasks'}
            {...(draggable ? attributes : {})}
            {...(draggable ? listeners : {})}
            onClick={(event) => event.stopPropagation()}
            disabled={!draggable || !canEdit}
          >
            <GripVertical size={17} aria-hidden="true" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            title={task.title}
            className={`task-title-button line-clamp-2 text-left text-sm font-semibold ${task.status === 'done' ? 'text-muted line-through' : 'text-foreground'}`}
            onClick={() => onOpen(task.id)}
            aria-label={`Open task ${task.title}`}
          >
            <span className="mr-1.5 inline-flex align-middle">
              {task.status === 'done'
                ? <Check size={15} aria-label="Completed" />
                : <Circle size={14} aria-hidden="true" />}
            </span>
            {task.title}
          </button>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted">{task.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={priority.tone}>
          <span aria-hidden="true">◆</span>
          {priority.label}
        </Badge>
        {due && (
          <Badge tone={due.tone}>
            <DueIcon size={13} aria-hidden="true" />
            {due.label}
          </Badge>
        )}
        {task.labels?.map((label) => (
          <Badge key={label} tone="neutral">{label}</Badge>
        ))}
      </div>

      {task.status === 'in_progress' && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[0.7rem] text-muted">
            <span>Progress</span>
            <span>{task.progress || 0}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-label={`Progress for ${task.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={task.progress || 0}
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${task.progress || 0}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {counts.total > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={`${counts.done} of ${counts.total} subtasks complete`}>
              <ListChecks size={14} aria-hidden="true" />
              {counts.done}/{counts.total}
            </span>
          )}
          {task.assignee ? (
            <Avatar
              name={task.assignee.display_name || task.assignee.email}
              email={task.assignee.email}
              color={task.assignee.avatar_color}
              className="!h-6 !w-6 !text-[0.62rem]"
            />
          ) : <span className="text-[0.68rem] text-muted">Unassigned</span>}
          {task.assignee && (
            <span className="sr-only">{task.assignee.display_name || task.assignee.email}</span>
          )}
        </div>
        {!overlay && (
          <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
        )}
        {!overlay && (
          <select
            id={`status-${task.id}`}
            value={task.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onStatusChange(task, event.target.value)}
            className="ui-input !min-h-8 w-auto max-w-32 py-1 text-xs"
            aria-label={`Change status for ${task.title}`}
            disabled={!canEdit}
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        )}
      </div>
    </m.article>
  );
};

export default TaskCard;
