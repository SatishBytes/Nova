import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '../api/axiosInstance';

const STATUS_ORDER = { todo: 0, in_progress: 1, done: 2 };
const sortTasks = (items) => [...items].sort((left, right) => (
  (STATUS_ORDER[left.status] ?? 3) - (STATUS_ORDER[right.status] ?? 3)
  || (left.position || 0) - (right.position || 0)
));

const getPosition = (items, index) => {
  const previous = items[index - 1]?.position;
  const next = items[index + 1]?.position;
  if (previous === undefined && next === undefined) return 0;
  if (previous === undefined) return next - 1000;
  if (next === undefined) return previous + 1000;
  return previous + (next - previous) / 2;
};

const useTasks = (projectId) => {
  const [tasks, setTasks] = useState([]);
  const tasksRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reorderTimer = useRef(null);
  const pendingMoves = useRef(new Map());
  const rollbackTasks = useRef(null);
  const deleteTimers = useRef(new Map());

  const fetchTasks = useCallback(async () => {
    try {
      const { data, headers } = await api.get(`/tasks/project/${projectId}`, { params: { limit: 50, offset: 0 } });
      const sorted = sortTasks(data);
      tasksRef.current = sorted;
      setTasks(sorted);
      setHasMore(Number(headers?.['x-total-count'] || data.length) > data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadMoreTasks = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = tasksRef.current.length;
      const { data, headers } = await api.get(`/tasks/project/${projectId}`, { params: { limit: 50, offset } });
      const next = sortTasks([...tasksRef.current, ...data]);
      tasksRef.current = next;
      setTasks(next);
      setHasMore(Number(headers?.['x-total-count'] || offset + data.length) > next.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load more tasks.');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, projectId]);

  const flushReorder = useCallback(async () => {
    if (reorderTimer.current) window.clearTimeout(reorderTimer.current);
    reorderTimer.current = null;
    const batch = [...pendingMoves.current.values()];
    const rollback = rollbackTasks.current;
    pendingMoves.current.clear();
    rollbackTasks.current = null;
    if (batch.length === 0) return;

    try {
      await api.post('/tasks/reorder', { project_id: projectId, moves: batch });
    } catch (error) {
      if (rollback) {
        tasksRef.current = rollback;
        setTasks(rollback);
      }
      toast.error(error.response?.data?.error || 'Unable to save task order. Changes were reverted.');
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(fetchTasks);
    return () => {
      void flushReorder();
    };
  }, [fetchTasks, flushReorder]);

  const createTask = useCallback(async (values) => {
    const { data } = await api.post('/tasks', { ...values, project_id: projectId });
    const next = sortTasks([...tasksRef.current, { ...data, subtasks: [], subtask_counts: { done: 0, total: 0 } }]);
    tasksRef.current = next;
    setTasks(next);
    return data;
  }, [projectId]);

  const updateTask = useCallback(async (taskId, updates) => {
    const { data } = await api.patch(`/tasks/${taskId}`, updates);
    const next = sortTasks(tasksRef.current.map((task) => (
      task.id === taskId ? { ...task, ...data } : task
    )));
    tasksRef.current = next;
    setTasks(next);
    return data;
  }, []);

  const scheduleReorder = useCallback((moves, previousTasks) => {
    if (!rollbackTasks.current) rollbackTasks.current = previousTasks;
    for (const move of moves) pendingMoves.current.set(move.id, move);
    if (reorderTimer.current) window.clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(() => { void flushReorder(); }, 250);
  }, [flushReorder]);

  const moveTask = useCallback((taskId, targetStatus, targetIndex) => {
    const current = tasksRef.current;
    const previousTasks = current;
    const movingTask = current.find((task) => task.id === taskId);
    if (!movingTask) return;

    const remaining = current.filter((task) => task.id !== taskId);
    const targetTasks = remaining
        .filter((task) => task.status === targetStatus)
        .map((task) => ({ ...task }))
        .sort((left, right) => left.position - right.position);
    const insertionIndex = Math.max(0, Math.min(targetIndex, targetTasks.length));
    const reorderedTarget = [...targetTasks];
    reorderedTarget.splice(insertionIndex, 0, { ...movingTask, status: targetStatus });

    let updatedMovingTask = reorderedTarget[insertionIndex];
    let moves;
    const left = reorderedTarget[insertionIndex - 1];
    const right = reorderedTarget[insertionIndex + 1];
    const position = getPosition(reorderedTarget, insertionIndex);
    if (
      left && right
      && (position === left.position || position === right.position)
    ) {
      reorderedTarget.forEach((task, index) => {
        task.position = (index + 1) * 1000;
      });
      updatedMovingTask = reorderedTarget[insertionIndex];
      moves = reorderedTarget.map(({ id, position: nextPosition }) => ({
        id,
        status: targetStatus,
        position: nextPosition,
      }));
    } else {
      updatedMovingTask = {
        ...updatedMovingTask,
        ...(targetStatus === 'done' ? { progress: 100 } : {}),
        position,
      };
      moves = [{ id: taskId, status: targetStatus, position }];
    }

    if (targetStatus === 'done' && !moves.some((move) => move.id === taskId && move.status === 'done')) {
      moves.push({ id: taskId, status: 'done', position: updatedMovingTask.position });
    }
    if (targetStatus === 'done') updatedMovingTask.progress = 100;

    const next = sortTasks([
      ...remaining.filter((task) => task.status !== targetStatus),
      ...reorderedTarget.map((task) => (
        task.id === taskId ? updatedMovingTask : task
      )),
    ]);
    tasksRef.current = next;
    setTasks(next);
    scheduleReorder(moves, previousTasks);
  }, [scheduleReorder]);

  const deleteTaskWithUndo = useCallback((taskId, onUndo) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    const next = tasksRef.current.filter((item) => item.id !== taskId);
    tasksRef.current = next;
    setTasks(next);
    const timer = window.setTimeout(async () => {
      deleteTimers.current.delete(taskId);
      try {
        await api.delete(`/tasks/${taskId}`);
      } catch (error) {
        const restored = sortTasks([...tasksRef.current, task]);
        tasksRef.current = restored;
        setTasks(restored);
        toast.error(error.response?.data?.error || 'Unable to delete task.');
      }
    }, 5000);
    deleteTimers.current.set(taskId, timer);

    toast('Task deleted', {
      description: 'You can undo this for a few seconds.',
      action: {
        label: 'Undo',
        onClick: () => {
          const pending = deleteTimers.current.get(taskId);
          if (pending) window.clearTimeout(pending);
          deleteTimers.current.delete(taskId);
          const restored = sortTasks([...tasksRef.current, task]);
          tasksRef.current = restored;
          setTasks(restored);
          onUndo?.();
        },
      },
    });
  }, [tasks]);

  const createSubtask = useCallback(async (taskId, title) => {
    const { data } = await api.post(`/tasks/${taskId}/subtasks`, { title });
    const next = tasksRef.current.map((task) => (
      task.id === taskId
        ? {
          ...task,
          subtasks: [...(task.subtasks || []), data],
          subtask_counts: { done: task.subtask_counts?.done || 0, total: (task.subtask_counts?.total || 0) + 1 },
        }
        : task
    ));
    tasksRef.current = next;
    setTasks(next);
    return data;
  }, []);

  const updateSubtask = useCallback(async (taskId, subtaskId, updates) => {
    const { data } = await api.patch(`/subtasks/${subtaskId}`, updates);
    const next = tasksRef.current.map((task) => {
      if (task.id !== taskId) return task;
      const subtasks = (task.subtasks || []).map((subtask) => (
        subtask.id === subtaskId ? { ...subtask, ...data } : subtask
      ));
      return {
        ...task,
        subtasks,
        subtask_counts: {
          total: subtasks.length,
          done: subtasks.filter((subtask) => subtask.done).length,
        },
      };
    });
    tasksRef.current = next;
    setTasks(next);
    return data;
  }, []);

  const deleteSubtask = useCallback(async (taskId, subtaskId) => {
    await api.delete(`/subtasks/${subtaskId}`);
    const next = tasksRef.current.map((task) => {
      if (task.id !== taskId) return task;
      const subtasks = (task.subtasks || []).filter((subtask) => subtask.id !== subtaskId);
      return {
        ...task,
        subtasks,
        subtask_counts: {
          total: subtasks.length,
          done: subtasks.filter((subtask) => subtask.done).length,
        },
      };
    });
    tasksRef.current = next;
    setTasks(next);
  }, []);

  return {
    tasks,
    setTasks,
    loading,
    fetchTasks,
    loadMoreTasks,
    hasMore,
    loadingMore,
    createTask,
    updateTask,
    moveTask,
    deleteTaskWithUndo,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  };
};

export default useTasks;
