import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../context/ThemeProvider';
import { useTheme } from '../context/useTheme';
import { expect, it } from 'vitest';

const ThemeProbe = () => {
  const { theme, cycleTheme } = useTheme();
  return <button type="button" onClick={cycleTheme}>{theme}</button>;
};

it('persists the selected theme preference across provider mounts', async () => {
  localStorage.clear();
  const firstRender = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'system' }));
  await waitFor(() => expect(localStorage.getItem('nova-theme')).toBe('light'));
  firstRender.unmount();

  render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
  expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
});
