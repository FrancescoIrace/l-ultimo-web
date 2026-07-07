import { useEffect, useRef, useState } from 'react';
import { X, Send, MoreVertical, Flag, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notifyNewMatchMessage } from '../lib/notificationService';
import { useAlert } from './AlertComponent';
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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const bottomRef = useRef(null);
    const menuRef = useRef(null);
    const { success, error: showError } = useAlert();

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

    useEffect(() => {
        if (!isMenuOpen) return;
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMenuOpen]);

    function handleOpenReport() {
        setIsMenuOpen(false);
        setReportReason('');
        setIsReportOpen(true);
    }

    async function handleSubmitReport() {
        if (!reportReason.trim()) {
            showError('Inserisci un motivo per la segnalazione');
            return;
        }

        setSubmittingReport(true);
        const { error } = await supabase
            .from('match_message_reports')
            .insert({
                match_id: matchId,
                reporter_id: currentUserId,
                reported_user_id: otherUserId,
                reason: reportReason.trim(),
            });
        setSubmittingReport(false);

        if (error) {
            console.error('Errore invio segnalazione chat:', error.message);
            showError('Impossibile inviare la segnalazione');
            return;
        }

        success('Segnalazione inviata, grazie per la tua collaborazione');
        setIsReportOpen(false);
        setReportReason('');
    }

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
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative" ref={menuRef}>
                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200"
                                aria-label="Altre opzioni"
                            >
                                <MoreVertical size={18} />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 z-20 w-48 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={handleOpenReport}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Flag size={14} />
                                        Segnala chat
                                    </button>
                                </div>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl px-3 py-2 mb-3 flex-shrink-0">
                    <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-semibold leading-snug">
                        Mantieni un tono rispettoso: offese o comportamenti scorretti in chat comportano il ban immediato dell'account.
                    </p>
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

            {isReportOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-[60]" onClick={() => setIsReportOpen(false)}>
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-black text-slate-800 uppercase mb-1">Segnala Chat</h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Spiegaci perché questa conversazione con <span className="font-bold">{otherUserName || 'questo utente'}</span> non rispetta le regole della community.
                        </p>
                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Descrivi il motivo della segnalazione..."
                            rows={4}
                            className="w-full border border-slate-200 rounded-2xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        <div className="flex gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setIsReportOpen(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitReport}
                                disabled={submittingReport}
                                className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-colors disabled:opacity-60"
                            >
                                {submittingReport ? 'Invio...' : 'Invia segnalazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
