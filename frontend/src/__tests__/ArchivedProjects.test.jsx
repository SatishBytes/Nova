import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArchivedProjects from '../pages/ArchivedProjects';
import DashboardRoute from '../components/DashboardRoute';
import api from '../api/axiosInstance';

vi.mock('../api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'user@example.test' }, logout: vi.fn() }),
}));

vi.mock('../context/useTheme', () => ({
  useTheme: () => ({ theme: 'light', cycleTheme: vi.fn() }),
}));

vi.mock('../components/NotificationBell', () => ({ default: () => null }));
describe('ArchivedProjects route', () => {
  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === '/projects/archived') return Promise.resolve({ data: [] });
      if (path === '/projects') return Promise.resolve({ data: [] });
      throw new Error(`Unexpected GET ${path}`);
    });
  });

  it.each(['/archived', '/dashboard#archived-projects'])(
    'renders the empty archive view and marks its sidebar link active at %s',
    async (initialEntry) => {
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/archived" element={<ArchivedProjects />} />
          <Route path="/my-tasks" element={<p>My tasks</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No archived projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Archived' })).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Archived - NOVA');
    },
  );
});
