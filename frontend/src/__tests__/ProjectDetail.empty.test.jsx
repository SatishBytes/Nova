import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectDetail from '../pages/ProjectDetail';
import api from '../api/axiosInstance';

const { channel, removeChannel } = vi.hoisted(() => {
  const realtimeChannel = {
    on: vi.fn(function on() { return this; }),
    subscribe: vi.fn(function subscribe() { return this; }),
  };
  return {
    channel: vi.fn(() => realtimeChannel),
    removeChannel: vi.fn(),
  };
});

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../config/supabaseClient', () => ({
  supabase: { channel, removeChannel },
}));

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../components/Navbar', () => ({
  default: () => <nav aria-label="Main navigation">NOVA</nav>,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  }),
}));

describe('ProjectDetail empty board', () => {
  beforeEach(() => {
    window.localStorage.clear();
    api.get.mockImplementation((path) => {
      if (path === '/projects/project-1') {
        return Promise.resolve({ data: { id: 'project-1', name: 'Test Project', role: 'owner' } });
      }
      if (path === '/tasks/project/project-1') return Promise.resolve({ data: [] });
      if (path === '/team/project/project-1' || path === '/projects/project-1/activity') {
        return Promise.resolve({ data: [] });
      }
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it('renders all empty columns and creates a task from an inline input', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({
      data: {
        id: 'task-1',
        title: 'Write project plan',
        status: 'todo',
        priority: 'medium',
        labels: [],
        position: 0,
        progress: 0,
        subtasks: [],
        subtask_counts: { done: 0, total: 0 },
      },
    });

    render(
      <MemoryRouter initialEntries={['/project/project-1']}>
        <Routes>
          <Route path="/project/:id" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /^To do/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^In progress/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Done/ })).toBeInTheDocument();

    const titleInput = screen.getByRole('textbox', { name: 'New task in To do' });
    expect(screen.getAllByRole('button', { name: /Add task/ }).length).toBeGreaterThan(0);
    await user.type(titleInput, 'Write project plan{enter}');

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tasks', {
        title: 'Write project plan',
        status: 'todo',
        project_id: 'project-1',
      });
    });
    expect(await screen.findByRole('button', { name: 'Open task Write project plan' })).toBeInTheDocument();
    expect(screen.getByText((_, element) => (
      element.classList.contains('project-stats-count')
      && element.textContent === '0 of 1 complete'
    ))).toBeInTheDocument();
  });

  it('keeps the task input above the empty message in list view', async () => {
    window.localStorage.setItem('nova-project-view', 'list');
    render(
      <MemoryRouter initialEntries={['/project/project-1']}>
        <Routes>
          <Route path="/project/:id" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByRole('textbox', { name: 'New task' });
    const emptyMessage = screen.getByText('No tasks yet. Add one above to get started.');
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.compareDocumentPosition(emptyMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
