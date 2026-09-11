import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';

const STATUS_CONFIG = {
  todo: { label: 'To do', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In progress', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' },
  done: { label: 'Done', dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
};

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [localProgress, setLocalProgress] = useState({});

  const fetchTasks = async () => {
    try {
      const res = await api.get(`/tasks/project/${id}`);
      setTasks(res.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [id]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.post('/tasks', { title, project_id: id });
      setTitle('');
      fetchTasks();
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleProgressDrag = (taskId, value) => {
    setLocalProgress((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleProgressCommit = async (taskId, value) => {
    try {
      await api.patch(`/tasks/${taskId}`, { progress: Number(value) });
      fetchTasks();
    } catch (err) {
      console.error('Error updating progress:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-slate-900 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Tasks</h2>

        {tasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-500">
                {doneCount} of {tasks.length} tasks done
              </span>
              <span className="text-slate-500 font-medium">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateTask} className="flex gap-2 mb-8">
          <input
            type="text"
            placeholder="Add a new task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors shadow-sm whitespace-nowrap"
          >
            + Add task
          </button>
        </form>

        {tasks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-300 rounded-xl bg-white/50">
            <p className="text-slate-500 text-sm font-medium">No tasks yet</p>
            <p className="text-slate-400 text-sm mt-1">Add your first task above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
              const currentProgress = localProgress[task.id] ?? task.progress ?? 0;
              return (
                <div
                  key={task.id}
                  className="group bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`}></span>

                    <span
                      className={`flex-1 text-sm ${
                        task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </span>

                    {task.status === 'in_progress' && (
                      <span className="text-xs text-amber-600 font-medium">{currentProgress}%</span>
                    )}

                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${status.badge}`}
                    >
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>

                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all text-sm px-1"
                    >
                      ✕
                    </button>
                  </div>

                  {task.status === 'in_progress' && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={currentProgress}
                        onChange={(e) => handleProgressDrag(task.id, e.target.value)}
                        onMouseUp={(e) => handleProgressCommit(task.id, e.target.value)}
                        onTouchEnd={(e) => handleProgressCommit(task.id, e.target.value)}
                        className="flex-1 h-1.5 accent-amber-500 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;