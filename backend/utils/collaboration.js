const supabase = require('../config/supabaseClient');
const { logBackgroundError } = require('./logger');

const recordActivity = async ({
  projectId,
  actorId,
  action,
  entityType,
  entityId,
  meta = {},
}) => {
  try {
    const { error } = await supabase.from('activity_log').insert([{
      project_id: projectId,
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      meta,
    }]);
    if (error) logBackgroundError('collaboration_activity_failed');
  } catch {
    logBackgroundError('collaboration_activity_failed');
  }
};

const createNotification = async ({
  userId,
  type,
  title,
  body = '',
  link,
  entityId,
  date = new Date().toISOString().slice(0, 10),
}) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .upsert([{
        user_id: userId,
        type,
        title,
        body,
        link,
        entity_id: entityId || null,
        dedupe_date: date,
      }], {
        onConflict: 'user_id,type,entity_id,dedupe_date',
        ignoreDuplicates: true,
      });

    if (error) logBackgroundError('collaboration_notification_failed');
  } catch {
    logBackgroundError('collaboration_notification_failed');
  }
};

const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_color')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

module.exports = { recordActivity, createNotification, getProfile };
