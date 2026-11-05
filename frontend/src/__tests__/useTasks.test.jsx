import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useTasks from '../hooks/useTasks';
import api from '../api/axiosInstance';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const task = (id, status = 'todo', position = 0) => ({
  id,
  title: `Task ${id}`,
  status,
  position,
  progress: 0,
  subtasks: [],
  subtask_counts: { done: 0, total: 0 },
});

describe('useTasks', () => {
  beforeEach(() => {
    api.get.mockResolvedValue({ data: [] });
  });

  it('adds a created task to the task list', async () => {
    const newTask = task('new');
    api.post.mockResolvedValue({ data: newTask });
    const { result } = renderHook(() => useTasks('project-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createTask({ title: 'Task new' });
    });

    expect(result.current.tasks).toContainEqual(expect.objectContaining({ id: 'new' }));
  });

  it('rolls back an optimistic status move when reordering fails', async () => {
    api.get.mockResolvedValue({ data: [task('a'), task('b')] });
    api.post.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTasks('project-1'));
    await waitFor(() => expect(result.current.tasks).toHaveLength(2));

    act(() => result.current.moveTask('a', 'done', 0));
    expect(result.current.tasks.find(({ id }) => id === 'a').status).toBe('done');
    expect(result.current.tasks.find(({ id }) => id === 'a').progress).toBe(100);

    await waitFor(() => {
      expect(result.current.tasks.find(({ id }) => id === 'a').status).toBe('todo');
    }, { timeout: 2000 });
    expect(api.post).toHaveBeenCalledWith('/tasks/reorder', {
      project_id: 'project-1',
      moves: [{ id: 'a', status: 'done', position: 0 }],
    });
  });
});
