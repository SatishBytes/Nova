import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Command,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import api from '../api/axiosInstance';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import Dropdown from './ui/Dropdown';
import Tooltip from './ui/Tooltip';
import NotificationBell from './NotificationBell';

const CommandPalette = lazy(() => import('./CommandPalette'));
const themeIcons = { system: Monitor, light: Sun, dark: Moon };

const Sidebar = ({ projects, currentProjectId, collapsed, onToggle, onNavigate }) => (
  <div className="app-sidebar-content">
    <div className="app-sidebar-brand">
      <Link to="/dashboard" className="app-sidebar-logo" aria-label="NOVA dashboard" onClick={onNavigate}>
        <span className="brand-mark" aria-hidden="true">N</span>
        {!collapsed && <span className="brand-name">NOVA</span>}
      </Link>
      <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Button
          variant="ghost"
          size="icon"
          className="app-sidebar-collapse"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight size={17} aria-hidden="true" /> : <ChevronLeft size={17} aria-hidden="true" />}
        </Button>
      </Tooltip>
    </div>

    <nav className="app-sidebar-nav" aria-label="Workspace navigation">
      <p className="app-sidebar-label">{collapsed ? '' : 'Workspace'}</p>
      <NavLink to="/dashboard" end onClick={onNavigate} title={collapsed ? 'Dashboard' : undefined}>
        <LayoutDashboard size={18} aria-hidden="true" />
        {!collapsed && <span>Dashboard</span>}
      </NavLink>
      <NavLink to="/my-tasks" end onClick={onNavigate} title={collapsed ? 'My tasks' : undefined} aria-label={collapsed ? 'My tasks' : undefined}>
        <ListChecks size={18} aria-hidden="true" />
        {!collapsed && <span>My tasks</span>}
      </NavLink>
      <NavLink to="/archived" end onClick={onNavigate} title={collapsed ? 'Archived' : undefined} aria-label={collapsed ? 'Archived projects' : undefined}>
        <Archive size={18} aria-hidden="true" />
        {!collapsed && <span>Archived</span>}
      </NavLink>

      <div className="app-sidebar-projects">
        <p className="app-sidebar-label">{collapsed ? '' : 'Projects'}</p>
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/project/${project.id}`}
            onClick={onNavigate}
            className={currentProjectId === project.id ? 'is-active' : ''}
            title={collapsed ? project.name : undefined}
            aria-label={collapsed ? project.name : undefined}
            aria-current={currentProjectId === project.id ? 'page' : undefined}
          >
            <span className="app-project-dot" aria-hidden="true" />
            {!collapsed && <span className="truncate">{project.name}</span>}
          </Link>
        ))}
        {!collapsed && projects.length === 0 && <p className="app-sidebar-empty">Your projects will appear here.</p>}
      </div>
    </nav>

    <div className="app-sidebar-footer">
      <NavLink to="/settings" onClick={onNavigate} title={collapsed ? 'Settings' : undefined} aria-label={collapsed ? 'Settings' : undefined}>
        <Settings size={18} aria-hidden="true" />
        {!collapsed && <span>Settings</span>}
      </NavLink>
    </div>
  </div>
);

const Navbar = ({ onSearch, pageTitle }) => {
  const { user, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const ThemeIcon = themeIcons[theme] || Monitor;
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [projects, setProjects] = useState([]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('nova-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const routeProjectId = location.pathname.match(/^\/project\/([^/]+)/)?.[1];
  const currentProject = projects.find((project) => project.id === routeProjectId);

  useEffect(() => {
    document.body.dataset.appShell = String(Boolean(user));
    document.body.dataset.sidebarCollapsed = String(collapsed);
    return () => {
      delete document.body.dataset.appShell;
      delete document.body.dataset.sidebarCollapsed;
    };
  }, [collapsed, user]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    api.get('/projects')
      .then(({ data }) => {
        if (active) setProjects(data);
      })
      .catch(() => {
        if (active) setProjects([]);
      });
    return () => { active = false; };
  }, [location.pathname, user?.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem('nova-sidebar-collapsed', String(collapsed));
    } catch {
      // The sidebar preference is optional.
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const drawer = drawerRef.current;
    const focusable = () => [...(drawer?.querySelectorAll('a[href], button:not([disabled])') || [])];
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) return undefined;
    const openPalette = () => {
      setShowShortcuts(false);
      setPaletteOpen(true);
    };
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      const commandKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (commandKey && key === 'k') {
        event.preventDefault();
        openPalette();
      } else if (event.altKey || commandKey || isTyping) {
        return;
      } else if (key === '/') {
        event.preventDefault();
        openPalette();
      } else if (key === 'n') {
        event.preventDefault();
        window.dispatchEvent(new Event('nova:create-task'));
      } else if (event.key === '?') {
        event.preventDefault();
        setShowShortcuts(true);
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('nova:open-command-palette', openPalette);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('nova:open-command-palette', openPalette);
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeDrawer = () => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  };

  const breadcrumbTitle = pageTitle || currentProject?.name || (location.pathname === '/settings' ? 'Settings' : 'Workspace');

  return (
    <>
      {user && (
        <>
          <aside className="app-sidebar" aria-label="Main sidebar">
            <Sidebar
              projects={projects}
              currentProjectId={routeProjectId}
              collapsed={collapsed}
              onToggle={() => setCollapsed((value) => !value)}
            />
          </aside>
          {mobileOpen && (
            <div className="app-drawer-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDrawer();
            }}>
              <aside
                ref={drawerRef}
                className="app-mobile-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Workspace navigation"
              >
                <div className="app-mobile-drawer-heading">
                  <span className="brand-name">NOVA</span>
                  <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={closeDrawer}>
                    <X size={18} aria-hidden="true" />
                  </Button>
                </div>
                <Sidebar
                  projects={projects}
                  currentProjectId={routeProjectId}
                  collapsed={false}
                  onToggle={() => {}}
                  onNavigate={closeDrawer}
                />
              </aside>
            </div>
          )}
        </>
      )}

      <header className={`site-header ${user ? 'app-topbar' : ''}`}>
        <div className="site-header-inner">
          <div className="app-topbar-leading">
            {user ? (
              <>
                <Button
                  ref={menuButtonRef}
                  variant="ghost"
                  size="icon"
                  className="app-mobile-menu-button"
                  aria-label="Open navigation"
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu size={19} aria-hidden="true" />
                </Button>
                <nav aria-label="Breadcrumb" className="app-breadcrumb">
                  <Link to="/dashboard">Dashboard</Link>
                  {routeProjectId && (
                    <>
                      <ChevronRight size={14} aria-hidden="true" />
                      <span>{breadcrumbTitle}</span>
                    </>
                  )}
                  {!routeProjectId && location.pathname !== '/dashboard' && (
                    <>
                      <ChevronRight size={14} aria-hidden="true" />
                      <span>{breadcrumbTitle}</span>
                    </>
                  )}
                </nav>
              </>
            ) : (
              <Link to="/" className="app-sidebar-logo" aria-label="NOVA home">
                <span className="brand-mark" aria-hidden="true">N</span>
                <span className="brand-name">NOVA</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user && (
              <Tooltip label="Search your workspace with / or open commands with Ctrl/⌘+K" align="end">
                <Button
                  variant="secondary"
                  className="!h-9 !min-h-9 !px-2.5 sm:!px-3"
                  aria-label="Search your workspace"
                  onClick={() => {
                    if (onSearch) {
                      window.dispatchEvent(new Event('nova:open-command-palette'));
                    } else {
                      setShowShortcuts(false);
                      setPaletteOpen(true);
                    }
                  }}
                >
                  <Search size={16} aria-hidden="true" />
                  <span className="hidden text-sm font-medium sm:inline">Search</span>
                  <kbd className="hidden rounded border border-border px-1 text-[0.65rem] text-muted lg:inline"><Command size={10} aria-label="Command" />K</kbd>
                </Button>
              </Tooltip>
            )}
            <Tooltip label={`Theme: ${theme}. Click to change.`} align="end">
              <Button variant="ghost" size="icon" aria-label={`Current theme: ${theme}. Change theme`} onClick={cycleTheme}>
                <ThemeIcon size={18} aria-hidden="true" />
              </Button>
            </Tooltip>
            {user ? (
              <>
                <NotificationBell />
                <Dropdown label="Open account menu" trigger={<Avatar name={user.user_metadata?.display_name} email={user.email} />}>
                  <div className="border-b border-border px-3 py-2">
                    <p className="truncate text-sm font-semibold text-foreground">{user.email}</p>
                    <p className="text-xs text-muted">Signed in</p>
                  </div>
                  <Link role="menuitem" to="/settings"><Settings size={16} aria-hidden="true" />Settings</Link>
                  <button type="button" role="menuitem" onClick={handleLogout}><LogOut size={16} aria-hidden="true" />Sign out</button>
                </Dropdown>
              </>
            ) : (
              <Link to="/login" className="text-sm font-medium text-muted hover:text-foreground">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      {user && paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            onSearch={onSearch}
            initialOpen={!showShortcuts}
            showShortcuts={showShortcuts}
            onClose={() => {
              setPaletteOpen(false);
              setShowShortcuts(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
};

export default Navbar;
