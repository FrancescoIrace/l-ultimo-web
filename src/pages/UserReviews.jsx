import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, ChevronLeft } from 'lucide-react';

export default function UserReviews({ session }) {
    const navigate = useNavigate();
    const { id } = useParams(); // /recensioni/:id
    const location = useLocation();
    const [loading, setLoading] = useState(true);
    const [reviews, setReviews] = useState([]);
    
    // Possiamo prendere l'username dal router state se passato
    const username = location.state?.username || 'Utente';
    
    // L'ID target delle recensioni
    const targetId = id || session?.user?.id;

    useEffect(() => {
        async function fetchReviews() {
            if (!targetId) return;
            setLoading(true);

            const { data, error } = await supabase
                .from('reviews')
                .select(`
                    rating,
                    comment,
                    created_at,
                    reviewer:reviewer_id ( username, avatar_url, id )
                `)
                .eq('target_id', targetId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Errore fetch reviews:", error.message);
            } else {
                setReviews(data || []);
            }
            setLoading(false);
        }

        fetchReviews();
    }, [targetId]);

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
                        <div key={index} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl">
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
        </main>
    );
}
