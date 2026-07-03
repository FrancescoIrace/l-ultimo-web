import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, ChevronLeft, MoreVertical, Flag, UserX } from 'lucide-react';
import { useAlert } from '../components/AlertComponent';

export default function UserReviews({ session }) {
    const navigate = useNavigate();
    const { id } = useParams(); // /recensioni/:id
    const location = useLocation();
    const { success, error: showError, confirmDangerous } = useAlert();
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [reportTarget, setReportTarget] = useState(null); // recensione in fase di segnalazione
    const [reportReason, setReportReason] = useState('');
    const [submittingReport, setSubmittingReport] = useState(false);
    const menuRef = useRef(null);

    // Possiamo prendere l'username dal router state se passato
    const username = location.state?.username || 'Utente';

    // L'ID target delle recensioni
    const targetId = id || session?.user?.id;
    const myUserId = session?.user?.id;

    useEffect(() => {
        async function fetchReviews() {
            if (!targetId) return;
            setLoading(true);

            // Recupera prima gli utenti bloccati, per escluderne subito le recensioni
            let blockedIds = [];
            if (myUserId) {
                const { data: blocks, error: blocksError } = await supabase
                    .from('user_blocks')
                    .select('blocked_id')
                    .eq('blocker_id', myUserId);

                if (blocksError) {
                    console.error('Errore fetch blocchi:', blocksError.message);
                } else {
                    blockedIds = (blocks || []).map(b => b.blocked_id);
                }
            }

            let query = supabase
                .from('reviews')
                .select(`
                    id,
                    rating,
                    comment,
                    created_at,
                    reviewer:reviewer_id ( username, avatar_url, id )
                `)
                .eq('target_id', targetId)
                .order('created_at', { ascending: false });

            if (blockedIds.length > 0) {
                query = query.not('reviewer_id', 'in', `(${blockedIds.join(',')})`);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Errore fetch reviews:", error.message);
            } else {
                setReviews(data || []);
            }
            setLoading(false);
        }

        fetchReviews();
    }, [targetId, myUserId]);

    // Chiude il menu contestuale al click fuori
    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpenReport = (rev) => {
        setOpenMenuId(null);
        setReportReason('');
        setReportTarget(rev);
    };

    const handleSubmitReport = async () => {
        if (!reportTarget || !myUserId) return;
        if (!reportReason.trim()) {
            showError('Inserisci un motivo per la segnalazione');
            return;
        }

        setSubmittingReport(true);
        const { error } = await supabase
            .from('review_reports')
            .insert({
                reporter_id: myUserId,
                review_id: reportTarget.id,
                reason: reportReason.trim(),
                status: 'pending',
            });
        setSubmittingReport(false);

        if (error) {
            console.error('Errore invio segnalazione:', error.message);
            showError('Impossibile inviare la segnalazione');
            return;
        }

        success('Segnalazione inviata, grazie per la tua collaborazione');
        setReportTarget(null);
        setReportReason('');
    };

    const handleBlockUser = async (rev) => {
        setOpenMenuId(null);
        if (!myUserId || !rev.reviewer?.id) return;

        const confirmed = await confirmDangerous(
            `Bloccare ${rev.reviewer.username}? Non vedrai più le sue recensioni.`
        );
        if (!confirmed) return;

        const { error } = await supabase
            .from('user_blocks')
            .insert({
                blocker_id: myUserId,
                blocked_id: rev.reviewer.id,
            });

        if (error) {
            console.error('Errore blocco utente:', error.message);
            showError('Impossibile bloccare l\'utente');
            return;
        }

        // Rimuove subito dalla vista tutte le recensioni dell'utente appena bloccato
        setReviews(prev => prev.filter(r => r.reviewer?.id !== rev.reviewer.id));
        success(`${rev.reviewer.username} è stato bloccato`);
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    if (loading) {
        return (
            <div className="p-10 flex flex-col items-center text-center uppercase font-black">
                <Loader size={48} strokeWidth={1.75} color="blue" className="loader-spin" />
                <span>attendi...</span>
            </div>
        );
    }

    return (
        <main className="max-w-md mx-auto p-6 pb-24 bg-slate-50 min-h-screen">
            <button
                onClick={handleBack}
                type="button"
                className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition"
            >
                <ChevronLeft size={16} />
                Indietro
            </button>

            <h1 className="text-3xl font-black text-slate-900 mb-2">Recensioni</h1>
            <p className="text-sm font-bold uppercase text-slate-400 mb-6 tracking-wide">
                RICEVUTE DA {id ? username : "TE"}
            </p>

            <div className="space-y-4">
                {reviews.length > 0 ? (
                    reviews.map((rev, index) => (
                        <div key={rev.id ?? index} className="relative p-5 bg-white border border-slate-100 shadow-sm rounded-3xl">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-black text-yellow-500 text-lg">
                                    {'★'.repeat(rev.rating)}
                                </span>
                                <span className="text-[10px] font-black uppercase text-slate-400 ml-auto">
                                    Da{' '}
                                    <span
                                        onClick={() => navigate(`/profile/${rev.reviewer.id}`)}
                                        className="text-blue-600 cursor-pointer hover:underline text-xs"
                                    >
                                        {rev.reviewer.username}
                                    </span>
                                </span>

                                {rev.reviewer?.id && rev.reviewer.id !== myUserId && (
                                    <div className="relative" ref={openMenuId === rev.id ? menuRef : null}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenMenuId(openMenuId === rev.id ? null : rev.id)}
                                            className="text-slate-300 hover:text-slate-500 transition-colors p-1 -mr-1"
                                            aria-label="Altre opzioni"
                                        >
                                            <MoreVertical size={16} />
                                        </button>

                                        {openMenuId === rev.id && (
                                            <div className="absolute right-0 top-7 z-10 w-44 bg-white border border-slate-100 rounded-2xl shadow-lg overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenReport(rev)}
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                                >
                                                    <Flag size={14} />
                                                    Segnala Recensione
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleBlockUser(rev)}
                                                    className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
                                                >
                                                    <UserX size={14} />
                                                    Blocca Utente
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-slate-700 mb-3 leading-relaxed">
                                {rev.comment ? `"${rev.comment}"` : <span className="italic text-slate-400">Nessun commento</span>}
                            </p>
                            <span className="text-[10px] uppercase font-bold text-slate-300">
                                {new Date(rev.created_at).toLocaleDateString('it-IT', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center">
                        <p className="font-bold text-slate-600">Nessuna recensione ricevuta.</p>
                        <p className="text-xs text-slate-400 mt-1">Quando giocherai, i giocatori potranno lasciarti un voto.</p>
                    </div>
                )}
            </div>

            {reportTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6">
                        <h2 className="text-lg font-black text-slate-800 uppercase mb-1">Segnala Recensione</h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Spiegaci perché la recensione di <span className="font-bold">{reportTarget.reviewer.username}</span> non rispetta le regole.
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
                                onClick={() => setReportTarget(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitReport}
                                disabled={submittingReport}
                                className="flex-1 py-3 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                                {submittingReport ? 'Invio...' : 'Invia Segnalazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
