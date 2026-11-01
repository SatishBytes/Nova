require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabaseClient');

const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/team');

const app = express();

const allowedOrigins = [
  'https://nova-eta-swart.vercel.app',
  'https://nova-pearl-beta.vercel.app',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean)
];

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
}));
app.use(express.json());

(async () => {
  const { data, error } = await supabase.from('projects').select('*').limit(1);
  if (error) {
<<<<<<< HEAD
    console.log(' Supabase connection failed:', error.message);
  } else {
    console.log(' Supabase connected successfully!');
=======
    console.error('Supabase connection failed:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
  } else {
    console.log('Supabase connected successfully');
>>>>>>> 5da444b (design system, theme, motion)
  }
})();

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);

app.get('/', (req, res) => {
  res.send('NOVA backend is running');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
