import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
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
      fetchProjects();
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>My Projects</h2>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <form onSubmit={handleCreateProject} style={{ marginBottom: '30px' }}>
        <input
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Create Project</button>
      </form>

      {projects.length === 0 ? (
        <p>No projects yet. Create one above.</p>
      ) : (
        projects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/project/${project.id}`)}
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              marginBottom: '10px',
              cursor: 'pointer',
            }}
          >
            <h3>{project.name}</h3>
            <p>{project.description}</p>
          </div>
        ))
      )}
    </div>
  );
};

export default Dashboard;