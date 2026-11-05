import { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  FolderPlus,
  HelpCircle,
  Archive,
  ListPlus,
  LogOut,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import Modal from './ui/Modal';
import Button from './ui/Button';

const CommandPalette = ({
  onSearch,
  onClose,
  initialOpen = true,
  showShortcuts = false,
}) => {
  const { user, logout } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const { id: projectId } = useParams();
  const [open, setOpen] = useState(initialOpen);
  const [helpOpen, setHelpOpen] = useState(showShortcuts);
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    onClose?.();
  }, [onClose]);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const { data } = await api.get('/projects');
      setProjects(data);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load projects for search.');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && user?.id) void Promise.resolve().then(fetchProjects);
  }, [fetchProjects, open, user?.id]);

  const createTask = useCallback(async () => {
    if (projectId) {
      window.dispatchEvent(new CustomEvent('nova:create-task'));
    } else {
      let availableProjects = projects;
      if (!availableProjects.length) {
        try {
          const { data } = await api.get('/projects');
          availableProjects = data;
          setProjects(data);
        } catch (error) {
          toast.error(error.response?.data?.error || 'Unable to find a project for this task.');
        }
      }
      const editableProject = availableProjects.find((project) => project.role !== 'viewer');
      if (editableProject) {
        navigate(`/project/${editableProject.id}`, { state: { createTask: true } });
      } else {
        navigate('/dashboard', { state: { openCreateProject: true } });
        toast.message('Create a project before adding tasks.');
      }
    }
    closePalette();
  }, [closePalette, navigate, projectId, projects]);

  const signOut = async () => {
    try {
      await logout();
      closePalette();
      navigate('/login');
    } catch {
      toast.error('Unable to sign out. Please try again.');
    }
  };

  const openNewProject = () => {
    closePalette();
    navigate('/dashboard', { state: { openCreateProject: true } });
  };

  const openShortcuts = () => {
    setOpen(false);
    setHelpOpen(true);
  };

  const closeShortcuts = () => {
    setHelpOpen(false);
    onClose?.();
  };

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const ThemeIcon = themeIcon;

  return (
    <>
      <Modal
        open={open}
        onClose={closePalette}
        title="Command palette"
        description="Search projects or run a workspace action."
        className="command-palette-dialog"
      >
        <Command label="Workspace commands" loop className="command-palette">
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search projects and commands..."
            aria-label="Search projects and commands"
            className="ui-input"
          />
          <Command.List className="command-palette-list">
            <Command.Empty className="p-4 text-center text-sm text-muted">
              {projectsLoading ? 'Loading projects…' : 'No matching projects or commands.'}
            </Command.Empty>
            <Command.Group heading="Actions">
              <Command.Item onSelect={openNewProject} value="create project">
                <FolderPlus size={16} aria-hidden="true" />
                <span>Create project</span>
              </Command.Item>
              <Command.Item onSelect={() => { closePalette(); navigate('/archived'); }} value="archived projects archive">
                <Archive size={16} aria-hidden="true" />
                <span>Archived</span>
              </Command.Item>
              <Command.Item onSelect={createTask} value="create task new task">
                <ListPlus size={16} aria-hidden="true" />
                <span>Create task</span>
                <kbd>N</kbd>
              </Command.Item>
              <Command.Item onSelect={() => { cycleTheme(); closePalette(); }} value="toggle theme light dark system">
                <ThemeIcon size={16} aria-hidden="true" />
                <span>Cycle theme</span>
              </Command.Item>
              <Command.Item onSelect={openShortcuts} value="keyboard shortcuts help">
                <HelpCircle size={16} aria-hidden="true" />
                <span>Keyboard shortcuts</span>
                <kbd>?</kbd>
              </Command.Item>
              <Command.Item onSelect={signOut} value="sign out logout">
                <LogOut size={16} aria-hidden="true" />
                <span>Sign out</span>
              </Command.Item>
              {query.trim() && onSearch && (
                <Command.Item
                  onSelect={() => {
                    onSearch(query.trim());
                    closePalette();
                  }}
                  value={`search projects for ${query}`}
                >
                  <span className="command-search-label">Search projects for “{query.trim()}”</span>
                </Command.Item>
              )}
            </Command.Group>
            <Command.Separator />
            <Command.Group heading="Projects">
              {projects.map((project) => (
                <Command.Item
                  key={project.id}
                  value={`${project.name} ${project.description || ''}`}
                  onSelect={() => {
                    closePalette();
                    navigate(`/project/${project.id}`);
                  }}
                >
                  <span className="brand-mark !h-7 !w-7 !text-xs" aria-hidden="true">N</span>
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {project.is_shared && <span className="text-xs text-muted">Shared</span>}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
          <div className="command-palette-footer">
            <span>Move with ↑ ↓</span>
            <span>Open with ↵</span>
            <Button variant="ghost" size="sm" onClick={openShortcuts}>Shortcuts</Button>
          </div>
        </Command>
      </Modal>

      <Modal
        open={helpOpen}
        onClose={closeShortcuts}
        title="Keyboard shortcuts"
        description="Use shortcuts when you are not typing in a field."
      >
        <dl className="shortcut-list">
          <div><dt>Open command palette</dt><dd><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd></dd></div>
          <div><dt>Search workspace</dt><dd><kbd>/</kbd></dd></div>
          <div><dt>Create task</dt><dd><kbd>N</kbd></dd></div>
          <div><dt>Show this help</dt><dd><kbd>?</kbd></dd></div>
          <div><dt>Toggle theme</dt><dd>Use the theme button or command palette</dd></div>
        </dl>
      </Modal>
    </>
  );
};

export default CommandPalette;
