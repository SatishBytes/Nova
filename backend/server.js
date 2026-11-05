require('dotenv').config();

const startServer = () => {
  const required = ['SUPABASE_URL', 'SUPABASE_KEY'];
  if (process.env.AI_ENABLED === 'true') required.push('ANTHROPIC_API_KEY');
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    process.stderr.write(`${JSON.stringify({
      level: 'error',
      event: 'startup_configuration_error',
      missing_environment_variables: missing,
    })}\n`);
    process.exitCode = 1;
    return null;
  }

  const app = require('./app');
  const supabase = require('./config/supabaseClient');

  (async () => {
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    if (error) {
      console.log(' Supabase connection failed:', error.message);
    } else {
      console.log(' Supabase connected successfully!');
    }
  })();

  const port = process.env.PORT || 5000;
  const server = app.listen(port, () => {
    process.stdout.write(`${JSON.stringify({ level: 'info', event: 'server_listening', port: Number(port) })}\n`);
  });

  const shutdown = (signal) => {
    process.stdout.write(`${JSON.stringify({ level: 'info', event: 'server_shutdown', signal })}\n`);
    server.close((error) => {
      if (error) {
        process.stderr.write(`${JSON.stringify({ level: 'error', event: 'server_close_failed' })}\n`);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', () => {
    process.stderr.write(`${JSON.stringify({ level: 'error', event: 'unhandled_rejection' })}\n`);
    server.close(() => process.exit(1));
  });

  return server;
};

if (require.main === module) startServer();

module.exports = startServer;