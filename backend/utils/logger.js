const logControllerError = (req, operation, status = 500) => {
  process.stderr.write(`${JSON.stringify({
    level: 'error',
    event: 'controller_error',
    operation,
    request_id: req.requestId || null,
    method: req.method || null,
    path: req.requestPath || req.path || null,
    status,
    duration_ms: req.requestStartedAt ? Date.now() - req.requestStartedAt : null,
  })}\n`);
};

const logBackgroundError = (event) => {
  process.stderr.write(`${JSON.stringify({
    level: 'error',
    event,
  })}\n`);
};

module.exports = { logControllerError, logBackgroundError };
