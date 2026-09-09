const supabase = require('../config/supabaseClient');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('Received header:', authHeader);   // ← temporary debug line

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  console.log('Extracted token length:', token.length);   // ← temporary debug line

  const { data, error } = await supabase.auth.getUser(token);

  console.log('Supabase error:', error);   // ← temporary debug line

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  next();
};

module.exports = authMiddleware;