const validateRequest = (schemas) => (req, res, next) => {
  const issues = [];

  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      issues.push(...result.error.issues.map((issue) => ({
        field: [part, ...issue.path].join('.'),
        message: issue.message,
      })));
    } else {
      if (part === 'query') req.validatedQuery = result.data;
      else req[part] = result.data;
    }
  }

  if (issues.length) return res.status(400).json({ error: 'Invalid request', details: issues });
  return next();
};

module.exports = validateRequest;
