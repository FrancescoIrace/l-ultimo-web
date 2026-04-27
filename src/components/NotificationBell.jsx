import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, X, Trash2, RefreshCw, UserPlus, Calendar, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function getNotificationStyles(type) {
  const styles = {
    match_promotion: {
      bg: 'bg-amber-50',
      dot: 'bg-amber-500',
      hover: 'hover:bg-amber-100',
    },
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
        className="relative z-50 p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors active:scale-95"
      >
        <Bell size={30} strokeWidth={2} /> {/* Usa solo la campanella qui */}

        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay sfocato */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Dropdown con animazione*/}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div /* Animazione di entrata e uscita */
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              // transition={{ duration: 0.2, ease: "easeOut" }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 flex flex-col">
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
                      const getIcon = (type) => {
                        switch (type) {
                          case 'match_promotion':
                            return <RefreshCw size={18} className="text-amber-600" />; // Icona per il ripescaggio
                          case 'match_join':
                            return <UserPlus size={18} className="text-green-600" />;
                          case 'match_reminder':
                            return <Calendar size={18} className="text-yellow-600" />;
                          case 'match_cancelled':
                            return <AlertTriangle size={18} className="text-slate-600" />;
                          default:
                            return <Bell size={18} className="text-blue-600" />;
                        }
                      };
                      return (
                        <li
                          key={notification.id}
                          onClick={() => {
                            markAsRead(notification.id);
                            navigate(notification.link);
                            setIsOpen(false);
                          }}
                          className={`p-4 ${styles.hover} transition-colors cursor-pointer ${!notification.is_read ? 'bg-slate-50/50' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* ICONA DINAMICA */}
                            <div className={`p-2 rounded-xl ${styles.bg} flex-shrink-0`}>
                              {getIcon(notification.type)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {notification.title}
                                </p>
                                {!notification.is_read && (
                                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                                )}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                {notification.content}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(notification.created_at).toLocaleDateString('it-IT', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>

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
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              className="fixed left-1/2 -translate-x-1/2 bottom-6 text-xs text-white z-50 pointer-events-none bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm"
            >
              Tocca fuori per chiudere
            </motion.p>

          </>
        )}
      </AnimatePresence>
    </div>
  );
}
