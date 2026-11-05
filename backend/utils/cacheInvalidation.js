const createCacheInvalidator = ({ supabase, redis } = {}) => {
  const getSupabase = () => supabase || require('../config/supabaseClient');
  const redisClient = redis || require('../lib/redis');
  let lastLookupWarningAt = 0;

  const warnLookupFailure = () => {
    if (Date.now() - lastLookupWarningAt < 60_000) return;
    lastLookupWarningAt = Date.now();
    process.stderr.write(`${JSON.stringify({
      level: 'warn',
      event: 'cache_invalidation_lookup_failed',
      message: 'Cache invalidation lookup failed; short TTL will clear stale data',
    })}\n`);
  };

  const invalidateForUser = async (userId) => {
    if (!userId || process.env.CACHE_ENABLED === 'false' || !redisClient.isRedisConfigured()) return;
    try {
      await redisClient.safeIncr(`nova:cachever:${userId}`);
    } catch {
      redisClient.warnUnavailable?.('redis_invalidation_failed');
    }
  };

  const invalidateForUsers = async (userIds) => {
    await Promise.all([...new Set(userIds.filter(Boolean))].map(invalidateForUser));
  };

  const invalidateForProject = async (projectId, additionalUserIds = []) => {
    if (!projectId || process.env.CACHE_ENABLED === 'false' || !redisClient.isRedisConfigured()) return;
    try {
      const client = getSupabase();
      const [projectResult, membersResult] = await Promise.all([
        client.from('projects').select('owner_id').eq('id', projectId).maybeSingle(),
        client.from('team_members').select('user_id').eq('project_id', projectId).eq('status', 'active'),
      ]);
      if (projectResult.error || membersResult.error) warnLookupFailure();

      const userIds = new Set([
        projectResult.data?.owner_id,
        ...(membersResult.data || []).map((member) => member.user_id),
        ...additionalUserIds,
      ].filter(Boolean));
      await invalidateForUsers([...userIds]);
    } catch {
      warnLookupFailure();
      await invalidateForUsers(additionalUserIds);
    }
  };

  return { invalidateForProject, invalidateForUser, invalidateForUsers };
};

const defaultInvalidator = createCacheInvalidator();

module.exports = {
  ...defaultInvalidator,
  createCacheInvalidator,
};
