import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/axiosInstance';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

const initialDraft = (task) => ({
  title: task.title || '',
  description: task.description || '',
  priority: task.priority || 'medium',
  due_date: task.due_date || '',
  labels: task.labels || [],
  status: task.status || 'todo',
  progress: task.status === 'done' ? 100 : task.progress || 0,
  assignee_id: task.assignee_id || null,
});

const TaskDetailsPanel = ({
  task,
  onClose,
  onSave,
  onDelete,
  onCreateSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  teamMembers = [],
  canEdit = true,
  realtimeKey = 0,
}) => {
  const [draft, setDraft] = useState(() => initialDraft(task));
  const [labelInput, setLabelInput] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [saveState, setSaveState] = useState('Saved');
  const initialSerialized = useRef(JSON.stringify(initialDraft(task)));
  const subtaskInputRef = useRef(null);

  const fetchComments = useCallback(async () => {
    try {
      const { data, headers } = await api.get(`/tasks/${task.id}/comments`, { params: { limit: 50, offset: 0 } });
      setComments(data);
      setCommentsHasMore(Number(headers?.['x-total-count'] || data.length) > data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load task comments.');
    } finally {
      setCommentsLoading(false);
    }
  }, [task.id]);

  const loadMoreComments = async () => {
    if (!commentsHasMore || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const offset = comments.length;
      const { data, headers } = await api.get(`/tasks/${task.id}/comments`, { params: { limit: 50, offset } });
      setComments((current) => [...current, ...data]);
      setCommentsHasMore(Number(headers?.['x-total-count'] || offset + data.length) > offset + data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load more comments.');
    } finally {
      setCommentsLoadingMore(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchComments);
  }, [fetchComments, realtimeKey]);

  useEffect(() => {
    if (!canEdit || JSON.stringify(draft) === initialSerialized.current) return undefined;
    setSaveState('Saving...');
    const timeout = window.setTimeout(async () => {
      try {
        await onSave({
          ...draft,
          description: draft.description,
          due_date: draft.due_date || null,
          progress: draft.status === 'done' ? 100 : Number(draft.progress),
        });
        initialSerialized.current = JSON.stringify(draft);
        setSaveState('Saved');
      } catch {
        setSaveState('Save failed — edits kept');
        toast.error('Unable to save task changes. Your edits are still here.');
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [canEdit, draft, onSave]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === 'status' && value === 'done' ? { progress: 100 } : {}),
    }));
  };

  const addLabel = (event) => {
    event.preventDefault();
    const label = labelInput.trim();
    if (!label || draft.labels.includes(label)) return;
    if (draft.labels.length >= 10 || label.length > 20) {
      toast.error('Use up to 10 labels, each 20 characters or fewer.');
      return;
    }
    updateDraft('labels', [...draft.labels, label]);
    setLabelInput('');
  };

  const handleCreateSubtask = async (event) => {
    event.preventDefault();
    const title = subtaskTitle.trim();
    if (!title || creatingSubtask) return;
    setCreatingSubtask(true);
    try {
      await onCreateSubtask(title);
      setSubtaskTitle('');
      subtaskInputRef.current?.focus();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to add subtask.');
    } finally {
      setCreatingSubtask(false);
    }
  };

  const toggleSubtask = async (subtask) => {
    try {
      await onUpdateSubtask(subtask.id, { done: !subtask.done });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update subtask.');
    }
  };

  const removeSubtask = async (subtaskId) => {
    try {
      await onDeleteSubtask(subtaskId);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to delete subtask.');
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body || postingComment) return;
    setPostingComment(true);
    try {
      const { data } = await api.post(`/tasks/${task.id}/comments`, { body });
      setComments((current) => [...current, data]);
      setCommentBody('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const createdAt = task.created_at ? parseISO(task.created_at) : null;
  const updatedAt = task.updated_at ? parseISO(task.updated_at) : null;

  return (
    <Modal
      open={Boolean(task)}
      onClose={onClose}
      title="Task details"
      description="Changes save automatically."
      className="task-panel-dialog"
    >
      <div className="space-y-5">
        <div className="flex justify-end">
          <Badge tone={saveState.startsWith('Save failed') ? 'danger' : 'neutral'} role="status">
            {saveState}
          </Badge>
        </div>

        <label className="block space-y-1.5 text-sm font-medium">
          <span>Title</span>
          <Input
            value={draft.title}
            onChange={(event) => updateDraft('title', event.target.value)}
            maxLength={100}
            aria-label="Task title"
            disabled={!canEdit}
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium">
          <span>Description</span>
          <textarea
            className="ui-input min-h-28 resize-y"
            value={draft.description}
            onChange={(event) => updateDraft('description', event.target.value)}
            maxLength={500}
            aria-label="Task description"
            placeholder="Add context, notes, or markdown-friendly details..."
            disabled={!canEdit}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Priority</span>
            <select className="ui-input" value={draft.priority} onChange={(event) => updateDraft('priority', event.target.value)} disabled={!canEdit}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Status</span>
            <select className="ui-input" value={draft.status} onChange={(event) => updateDraft('status', event.target.value)} disabled={!canEdit}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Due date</span>
            <Input type="date" value={draft.due_date} onChange={(event) => updateDraft('due_date', event.target.value)} disabled={!canEdit} />
          </label>
          {draft.status === 'in_progress' && (
            <label className="block space-y-1.5 text-sm font-medium">
              <span className="flex justify-between"><span>Progress</span><span>{draft.progress}%</span></span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={draft.progress}
                onChange={(event) => updateDraft('progress', Number(event.target.value))}
                className="w-full accent-[var(--primary)]"
                aria-label="Task progress"
                disabled={!canEdit}
              />
            </label>
          )}
        </div>

        <section aria-labelledby="task-labels-heading">
          <h3 id="task-labels-heading" className="mb-2 text-sm font-semibold">Labels</h3>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.labels.map((label) => (
              <Badge key={label} tone="neutral">
                {label}
                <button
                  type="button"
                  className="ml-1 rounded-full"
                  aria-label={`Remove label ${label}`}
                  onClick={() => updateDraft('labels', draft.labels.filter((item) => item !== label))}
                  disabled={!canEdit}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <form onSubmit={addLabel} className="flex gap-2">
            <Input
              value={labelInput}
              onChange={(event) => setLabelInput(event.target.value)}
              placeholder="Add a label"
              maxLength={20}
              aria-label="New label"
              disabled={!canEdit}
            />
            <Button type="submit" variant="secondary" aria-label="Add label" disabled={!canEdit}><Plus size={16} aria-hidden="true" /></Button>
          </form>
        </section>

        <label className="block space-y-1.5 text-sm font-medium">
          <span>Assignee</span>
          <select
            className="ui-input"
            value={draft.assignee_id || ''}
            onChange={(event) => updateDraft('assignee_id', event.target.value || null)}
            disabled={!canEdit}
            aria-label="Task assignee"
          >
            <option value="">Unassigned</option>
            {teamMembers.filter((member) => member.status === 'active').map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.profile?.display_name || member.email || 'Project member'}
                {member.role === 'owner' ? ' (Owner)' : ''}
              </option>
            ))}
          </select>
        </label>

        <section aria-labelledby="subtasks-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="subtasks-heading" className="text-sm font-semibold">Subtasks</h3>
            <span className="text-xs text-muted">
              {task.subtask_counts?.done || 0}/{task.subtask_counts?.total || 0} complete
            </span>
          </div>
          <ul className="space-y-2">
            {(task.subtasks || []).map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subtask.done}
                  onChange={() => toggleSubtask(subtask)}
                  aria-label={`Mark ${subtask.title} ${subtask.done ? 'not done' : 'done'}`}
                  className="h-4 w-4 accent-[var(--primary)]"
                  disabled={!canEdit}
                />
                <span className={`min-w-0 flex-1 text-sm ${subtask.done ? 'text-muted line-through' : ''}`}>{subtask.title}</span>
                <Button variant="ghost" size="icon" aria-label={`Delete subtask ${subtask.title}`} onClick={() => removeSubtask(subtask.id)} disabled={!canEdit}>
                  <Trash2 size={15} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={handleCreateSubtask} className="mt-3 flex gap-2">
            <Input
              ref={subtaskInputRef}
              value={subtaskTitle}
              onChange={(event) => setSubtaskTitle(event.target.value)}
              placeholder="Add a subtask"
              maxLength={100}
              aria-label="New subtask title"
              disabled={!canEdit}
            />
            <Button type="submit" variant="secondary" aria-label="Create subtask" disabled={!canEdit || !subtaskTitle.trim() || creatingSubtask}>
              <Plus size={16} aria-hidden="true" />
            </Button>
          </form>
        </section>

        <section aria-labelledby="task-comments-heading">
          <h3 id="task-comments-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MessageCircle size={16} aria-hidden="true" />
            Comments
            <span className="text-xs font-normal text-muted">{comments.length}</span>
          </h3>
          {commentsLoading ? (
            <p className="text-sm text-muted" role="status">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="mb-3 rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted">Start the conversation.</p>
          ) : (
            <ul className="mb-3 max-h-64 space-y-3 overflow-y-auto">
              {comments.map((comment) => (
                <li key={comment.id} className="flex items-start gap-2">
                  <Avatar
                    name={comment.author?.display_name || comment.author?.email}
                    email={comment.author?.email}
                    color={comment.author?.avatar_color}
                    className="!h-7 !w-7 !text-[0.62rem]"
                  />
                  <div className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="text-xs font-semibold">{comment.author?.display_name || comment.author?.email || 'Teammate'}</span>
                      <time className="text-[0.68rem] text-muted" dateTime={comment.created_at}>
                        {format(parseISO(comment.created_at), 'MMM d · h:mm a')}
                        {comment.edited_at ? ' · edited' : ''}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {commentsHasMore && (
            <Button variant="ghost" size="sm" className="mb-3" onClick={loadMoreComments} disabled={commentsLoadingMore}>
              {commentsLoadingMore ? 'Loading…' : 'Load earlier comments'}
            </Button>
          )}
          {canEdit && (
            <form onSubmit={submitComment}>
              <label className="sr-only" htmlFor={`comment-${task.id}`}>Write a comment</label>
              <textarea
                id={`comment-${task.id}`}
                className="ui-input min-h-20 resize-y"
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                maxLength={2000}
                placeholder="Write a comment... Mention a teammate with @email"
                aria-describedby={`comment-hint-${task.id}`}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span id={`comment-hint-${task.id}`} className="text-xs text-muted">Up to 2,000 characters</span>
                <Button type="submit" size="sm" disabled={!commentBody.trim() || postingComment}>
                  <Send size={14} aria-hidden="true" />
                  Comment
                </Button>
              </div>
            </form>
          )}
        </section>

        <div className="border-t border-border pt-3 text-xs text-muted">
          {createdAt && <p>Created {format(createdAt, 'MMM d, yyyy · h:mm a')}</p>}
          {updatedAt && <p className="mt-1">Updated {format(updatedAt, 'MMM d, yyyy · h:mm a')}</p>}
        </div>

        {canEdit && <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            if (window.confirm('Delete this task? You can undo for a few seconds.')) {
              onDelete();
            }
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete task
        </Button>}
      </div>
    </Modal>
  );
};

export default TaskDetailsPanel;
