import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notifyNewMatchMessage } from '../lib/notificationService';
import Loader from './Loader';

/**
 * Modale con il thread di messaggi tra organizzatore e centro sportivo per
 * una partita. Riusata sia lato organizzatore (MatchDetailV2) che lato
 * centro (BusinessDashboard) passando currentUserId/otherUserId invertiti.
 */
export default function MatchMessageThread({
    isOpen,
    onClose,
    matchId,
    currentUserId,
    currentUserName,
    otherUserId,
    otherUserName,
    matchLabel,
    recipientLink,
}) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const bottomRef = useRef(null);

    // Blocca lo scroll della pagina sotto la modale
    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !matchId || !otherUserId) return;

        const loadMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('match_messages')
                .select('*')
                .eq('match_id', matchId)
                .or(`and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Errore caricamento messaggi:', error);
                setMessages([]);
            } else {
                setMessages(data || []);

                // Segna come letti i messaggi ricevuti non ancora letti
                const unreadIds = (data || [])
                    .filter(m => m.recipient_id === currentUserId && !m.read_at)
                    .map(m => m.id);
                if (unreadIds.length > 0) {
                    await supabase
                        .from('match_messages')
                        .update({ read_at: new Date().toISOString() })
                        .in('id', unreadIds);
                }
            }
            setLoading(false);
        };

        loadMessages();
    }, [isOpen, matchId, otherUserId, currentUserId]);

    useEffect(() => {
        if (isOpen) bottomRef.current?.scrollIntoView({ block: 'nearest' });
    }, [messages, isOpen]);

    async function handleSend() {
        const content = newMessage.trim();
        if (!content || sending) return;

        setSending(true);
        const { data, error } = await supabase
            .from('match_messages')
            .insert({ match_id: matchId, sender_id: currentUserId, recipient_id: otherUserId, content })
            .select()
            .single();

        if (error) {
            console.error('Errore invio messaggio:', error);
            setSending(false);
            return;
        }

        setMessages(prev => [...prev, data]);
        setNewMessage('');
        setSending(false);

        notifyNewMatchMessage(otherUserId, currentUserId, matchId, currentUserName || 'Un utente', content, recipientLink);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-slate-800 truncate">{otherUserName || 'Messaggi'}</h3>
                        {matchLabel && <p className="text-xs text-slate-400 truncate">{matchLabel}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-2">
                    {loading ? (
                        <Loader variant="section" label="Caricamento messaggi..." />
                    ) : messages.length === 0 ? (
                        <div className="text-center p-8 text-sm font-bold text-slate-400">Nessun messaggio. Scrivi il primo!</div>
                    ) : (
                        messages.map(m => {
                            const isMine = m.sender_id === currentUserId;
                            return (
                                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                                        <span className={`block text-[10px] mt-1 ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                                            {new Date(m.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="flex items-end gap-2 mt-4 flex-shrink-0">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Scrivi un messaggio..."
                        rows={1}
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all flex-shrink-0"
                    >
                        {sending ? <Loader variant="inline" size={18} color="white" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
