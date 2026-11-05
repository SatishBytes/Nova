import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/axiosInstance';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/useAuth';

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const detailsRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, headers } = await api.get('/notifications', { params: { limit: 50, offset: 0 } });
      setNotifications(data);
      setHasMore(Number(headers?.['x-total-count'] || data.length) > data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load notifications.');
    }
  }, []);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = notifications.length;
      const { data, headers } = await api.get('/notifications', { params: { limit: 50, offset } });
      setNotifications((current) => [...current, ...data]);
      setHasMore(Number(headers?.['x-total-count'] || offset + data.length) > offset + data.length);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    void Promise.resolve().then(fetchNotifications);
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        void fetchNotifications();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, user?.id]);

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      try {
        await api.patch(`/notifications/${notification.id}/read`);
        setNotifications((current) => current.map((item) => (
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )));
      } catch (error) {
        toast.error(error.response?.data?.error || 'Unable to mark notification as read.');
      }
    }
    if (detailsRef.current) detailsRef.current.open = false;
    navigate(notification.link || '/dashboard');
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to mark notifications as read.');
    }
  };

  return (
    <details ref={detailsRef} className="notification-wrap">
      <summary className="notification-trigger" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </summary>
      <div className="notification-panel" aria-label="Notifications">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary" onClick={markAllRead}>
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="p-5 text-center text-sm text-muted">You're all caught up.</p>
        ) : (
          <>
            <ul className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-item ${notification.read_at ? '' : 'notification-unread'}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-dot" aria-hidden="true">{notification.read_at ? '○' : '●'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-left text-sm font-medium">{notification.title}</span>
                      {notification.body && <span className="mt-0.5 block text-left text-xs text-muted">{notification.body}</span>}
                      <time className="mt-1 block text-left text-[0.68rem] text-muted" dateTime={notification.created_at}>
                        {new Date(notification.created_at).toLocaleString()}
                      </time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <button type="button" className="w-full border-t border-border p-2 text-xs font-medium text-primary hover:bg-accent" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
};

export default NotificationBell;
