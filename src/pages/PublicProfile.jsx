import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PublicProfile() {
    const { id } = useParams(); // Prende l'ID dall'URL
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getPublicProfile() {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error("Profilo non trovato");
                navigate('/'); // O una pagina 404
            } else {
                setProfile(data);
            }
            setLoading(false);
        }

        if (id) getPublicProfile();
    }, [id, navigate]);

    if (loading) return <div className="p-10 text-center font-black">CARICAMENTO...</div>;

    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            {/* Tasto Indietro */}
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
                TORNA INDIETRO
            </button>

            <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-blue-50 shadow-xl overflow-hidden">
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <span className="font-black text-blue-600">{profile?.username?.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">
                    {profile?.username}
                </h2>
                <p className="text-blue-600 font-bold text-sm uppercase tracking-widest mt-1">
                    {profile?.province}
                </p>
            </div>

            {/* Statistiche o Bio (Esempio per dati futuri) */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Sport Preferito</p>
                    <p className="font-bold text-slate-700">Padel</p> {/* Hardcoded per ora */}
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Affidabilità</p>
                    <p className="font-bold text-green-600">100%</p> {/* Idea per recensioni */}
                </div>
            </div>

            {/* Qui in futuro caricheremo le recensioni */}
            <div className="mt-10 border-t border-slate-100 pt-6">
                <h3 className="font-black uppercase text-sm text-slate-400 mb-4">Cosa dicono di {profile?.username}</h3>
                <p className="text-slate-300 text-sm italic">Ancora nessuna recensione.</p>
            </div>
        </div>
    );
}