require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./config/supabaseClient');

const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/team');

const app = express();

app.use(cors());
app.use(express.json());

(async () => {
  const { data, error } = await supabase.from('projects').select('*').limit(1);
  if (error) {
    console.log(' Supabase connection failed:', error.message);
  } else {
    console.log(' Supabase connected successfully!');
  }
})();

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);

app.get('/', (req, res) => {
  res.send('NOVA backend is running');
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
