import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';

vi.mock('../context/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

it('redirects logged-out users to the login page', () => {
  render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route path="/private" element={<ProtectedRoute><p>Private workspace</p></ProtectedRoute>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByText('Login page')).toBeInTheDocument();
  expect(screen.queryByText('Private workspace')).not.toBeInTheDocument();
});
