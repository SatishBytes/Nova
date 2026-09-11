import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

const CARD_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'group-hover:ring-indigo-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'group-hover:ring-teal-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'group-hover:ring-amber-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'group-hover:ring-rose-200' },
  { bg: 'bg-sky-100', text: 'text-sky-700', ring: 'group-hover:ring-sky-200' },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      fetchProjects();
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    return projects.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [projects, search]);

  const firstName = user?.email?.split('@')[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
            <span className="text-white text-sm font-semibold">N</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">NOVA</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {projects.length === 0
              ? "You don't have any projects yet"
              : `${projects.length} project${projects.length > 1 ? 's' : ''} in your workspace`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors shadow-sm whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ New project'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateProject}
            className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-8"
          >
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Create project
            </button>
          </form>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-slate-300 rounded-xl bg-white/50">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-400 text-2xl">+</span>
            </div>
            <p className="text-slate-700 text-sm font-medium">No projects yet</p>
            <p className="text-slate-400 text-sm mt-1 mb-4">Create your first project to get started</p>
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              + New project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No projects match "{search}"
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredProjects.map((project, i) => {
              const color = CARD_COLORS[i % CARD_COLORS.length];
              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="group bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-300 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-11 h-11 rounded-lg ${color.bg} ${color.text} flex items-center justify-center font-semibold ring-4 ring-transparent ${color.ring} transition-all`}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="text-xs text-slate-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded-md"
                    >
                      Delete
                    </button>
                  </div>

                  <h3 className="font-medium text-slate-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {project.description || 'No description'}
                  </p>

                  <div className="flex items-center text-xs text-indigo-600 font-medium">
                    Open project
                    <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;