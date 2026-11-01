import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import Dropdown from './ui/Dropdown';
import Input from './ui/Input';
import Modal from './ui/Modal';
import Tooltip from './ui/Tooltip';

const themeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const Navbar = ({ backTo, onSearch }) => {
  const { user, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ThemeIcon = themeIcons[theme] || Monitor;

  const submitSearch = (event) => {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;

    if (onSearch) {
      onSearch(search);
    } else {
      navigate('/dashboard', { state: { search } });
    }

    setSearchOpen(false);
    setQuery('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="flex min-w-0 items-center gap-3">
            {backTo && (
              <Tooltip label="Back to dashboard" align="start">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to dashboard"
                  onClick={() => navigate(backTo)}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </Button>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={() => navigate(user ? '/dashboard' : '/login')}
              className="flex items-center gap-2.5 rounded-lg"
              aria-label="NOVA home"
            >
              <span className="brand-mark" aria-hidden="true">N</span>
              <span className="brand-name">NOVA</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Tooltip label="Search your workspace" align="end">
              <Button
                variant="secondary"
                className="!h-9 !min-h-9 !px-2.5 sm:!px-3"
                aria-label="Search your workspace"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={16} aria-hidden="true" />
                <span className="hidden text-sm font-medium sm:inline">Search</span>
              </Button>
            </Tooltip>

            <Tooltip label={`Theme: ${theme}. Click to change.`} align="end">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Current theme: ${theme}. Change theme`}
                onClick={cycleTheme}
              >
                <ThemeIcon size={18} aria-hidden="true" />
              </Button>
            </Tooltip>

            {user && (
              <Dropdown
                label="Open account menu"
                trigger={<Avatar email={user.email} />}
              >
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
                  <p className="text-xs text-muted">Signed in</p>
                </div>
                <button type="button" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
                </button>
              </Dropdown>
            )}
          </div>
        </div>
      </header>

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search workspace"
        description="Find a project by name."
      >
        <form onSubmit={submitSearch} className="space-y-4">
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!query.trim()}>
              <Search size={16} aria-hidden="true" />
              Search
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default Navbar;
