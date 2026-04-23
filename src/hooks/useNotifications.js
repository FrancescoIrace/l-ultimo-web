import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch notifiche iniziali
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      
      setNotifications(data || []);
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
      setError(null);
    } catch (err) {
      console.error('Errore nel fetch notifiche:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Real-time subscription per nuove notifiche
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    // Subscribe a nuove notifiche in tempo reale
    const subscription = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Nuova notifica
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            // Notifica aggiornata (es: segnata come letta)
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new : n)
            );
            if (!payload.old.is_read && payload.new.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          } else if (payload.eventType === 'DELETE') {
            // Notifica cancellata
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            if (!payload.old.is_read) {
              setUnreadCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchNotifications]);

  // Segna una notifica come letta
  const markAsRead = useCallback(async (notificationId) => {
    // Aggiornamento ottimistico
    const oldNotifications = notifications;
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    
    const wasUnread = notifications.find(n => n.id === notificationId)?.is_read === false;
    if (wasUnread) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.error('Errore nel segnare notifica come letta:', err);
      // Revert in caso di errore
      setNotifications(oldNotifications);
      if (wasUnread) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [notifications]);

  // Segna tutte le notifiche come lette
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    // Aggiornamento ottimistico
    const oldNotifications = notifications;
    const unreadCount_ = notifications.filter(n => !n.is_read).length;
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (err) {
      console.error('Errore nel segnare tutte le notifiche come lette:', err);
      // Revert in caso di errore
      setNotifications(oldNotifications);
      setUnreadCount(unreadCount_);
    }
  }, [userId, notifications]);

  // Cancella una notifica
  const deleteNotification = useCallback(async (notificationId) => {
    // Aggiornamento ottimistico
    const oldNotifications = notifications;
    const deletedNotification = notifications.find(n => n.id === notificationId);
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    if (deletedNotification && !deletedNotification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.error('Errore nel cancellare notifica:', err);
      // Revert in caso di errore
      setNotifications(oldNotifications);
      if (deletedNotification && !deletedNotification.is_read) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [notifications]);

  // Cancella tutte le notifiche lette
  const deleteAllRead = useCallback(async () => {
    if (!userId) return;
    
    // Aggiornamento ottimistico
    const oldNotifications = notifications;
    const unreadCount_ = notifications.filter(n => !n.is_read).length;
    
    setNotifications(prev => prev.filter(n => !n.is_read));
    setUnreadCount(unreadCount_);

    try {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .match({ is_read: true });

      console.log('Delete response:', { data, error });

      if (error) throw error;
    } catch (err) {
      console.error('Errore nel cancellare notifiche lette:', err);
      // Revert in caso di errore
      setNotifications(oldNotifications);
      setUnreadCount(unreadCount_);
    }
  }, [userId, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    refetch: fetchNotifications,
  };
}
