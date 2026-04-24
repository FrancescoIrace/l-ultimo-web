import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Trash2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

function getNotificationStyles(type) {
  const styles = {
    match_join: {
      bg: 'bg-green-50',
      dot: 'bg-green-500',
      hover: 'hover:bg-green-100',
    },
    match_leave: {
      bg: 'bg-red-50',
      dot: 'bg-red-500',
      hover: 'hover:bg-red-100',
    },
    match_update: {
      bg: 'bg-blue-50',
      dot: 'bg-blue-500',
      hover: 'hover:bg-blue-100',
    },
    match_cancelled: {
      bg: 'bg-slate-100',
      dot: 'bg-slate-600',
      hover: 'hover:bg-slate-200',
    },
    match_reminder: {
      bg: 'bg-yellow-50',
      dot: 'bg-yellow-500',
      hover: 'hover:bg-yellow-100',
    },
    team_invite: {
      bg: 'bg-purple-50',
      dot: 'bg-purple-500',
      hover: 'hover:bg-purple-100',
    },
  };
  return styles[type] || styles.match_update;
}

export function NotificationBell({ userId }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications(userId);

  // Chiudi dropdown quando clicchi fuori
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bottone Campanella */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors active:scale-95"
      >
        <Bell size={24} strokeWidth={2} />
        
        {/* Badge contatore */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Notifiche</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                Segna tutto come letto
              </button>
            )}
          </div>

          {/* Lista Notifiche */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell size={40} className="mx-auto mb-2 opacity-30" />
                <p>Nessuna notifica</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((notification) => {
                  const styles = getNotificationStyles(notification.type);
                  return (
                  <li
                    key={notification.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      !notification.is_read ? styles.bg : ''
                    } ${styles.hover}`}
                  >
                    <div
                      onClick={() => handleNotificationClick(notification)}
                      className="flex gap-3 mb-2"
                    >
                      {/* Pallino colorato non letto */}
                      {!notification.is_read && (
                        <div className={`w-2 h-2 ${styles.dot} rounded-full mt-1.5 flex-shrink-0`}></div>
                      )}
                      
                      {/* Contenuto */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 text-sm">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {notification.content}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notification.created_at).toLocaleDateString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {/* Bottone elimina */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </li>
                );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.some(n => n.is_read) && (
            <div className="p-3 border-t border-slate-200 text-center">
              <button
                onClick={deleteAllRead}
                className="text-xs text-slate-500 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={14} />
                Cancella notifiche lette
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
