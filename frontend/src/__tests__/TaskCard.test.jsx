import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskCard from '../components/tasks/TaskCard';

vi.mock('motion/react', async () => {
  const React = await import('react');
  return {
    m: {
      article: React.forwardRef((props, ref) => {
        const domProps = Object.fromEntries(
          Object.entries(props).filter(([key]) => key !== 'layout' && key !== 'children'),
        );
        return React.createElement('article', { ...domProps, ref }, props.children);
      }),
    },
    useReducedMotion: () => true,
  };
});

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

const makeTask = (overrides = {}) => ({
  id: 'task-1',
  title: 'Write tests',
  status: 'todo',
  priority: 'medium',
  position: 0,
  ...overrides,
});

describe('TaskCard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00'));
  });

  it('shows an overdue label with an icon for past-due work', () => {
    render(<TaskCard task={makeTask({ due_date: '2026-01-13' })} onOpen={() => {}} onStatusChange={() => {}} />);
    expect(screen.getByText('2 days overdue')).toBeInTheDocument();
  });

  it('shows a due-soon label for tomorrow', () => {
    render(<TaskCard task={makeTask({ due_date: '2026-01-16' })} onOpen={() => {}} onStatusChange={() => {}} />);
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
  });

  it('disables edit controls for viewers', () => {
    render(<TaskCard task={makeTask()} canEdit={false} onOpen={() => {}} onStatusChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Change status for Write tests' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Drag task Write tests' })).toBeDisabled();
  });
});
