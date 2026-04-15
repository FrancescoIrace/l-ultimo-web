import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function CreateMatch() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        sport: 'Calcetto',
        title: '',
        datetime: '',
        location: '',
        max_players: 10
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // 1. Inseriamo la partita
        // .select() alla fine ci permette di ricevere indietro i dati appena creati
        const { data: newMatch, error: matchError } = await supabase
            .from('matches')
            .insert([
                {
                    ...formData,
                    current_players: 1, // L'organizzatore è il primo
                    creator_id: (await supabase.auth.getUser()).data.user.id // Assicuriamoci di passare l'ID
                }
            ])
            .select()
            .single();

        if (matchError) {
            alert("Errore creazione partita: " + matchError.message);
            setLoading(false);
            return;
        }

        // 2. Se la partita è creata, aggiungiamo il creatore ai partecipanti
        if (newMatch) {
            const { error: partError } = await supabase
                .from('participants')
                .insert([
                    {
                        match_id: newMatch.id,
                        user_id: newMatch.creator_id
                    }
                ]);

            if (partError) {
                console.error("Errore aggiunta creatore ai partecipanti:", partError.message);
            }
        }

        alert("Partita organizzata! Sei già in lista.");
        navigate('/');
        setLoading(false);
    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Organizza Match</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sport</label>
                    <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.sport}
                        onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                    >
                        <option>Calcetto</option>
                        <option>Padel</option>
                        <option>Basket</option>
                        <option>Tennis</option>
                        <option>Volley</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titolo (Opzionale)</label>
                    <input
                        type="text"
                        placeholder="Es: Partitella tra amici"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quando</label>
                        <input
                            type="datetime-local"
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giocatori Totali</label>
                        <input
                            type="number"
                            required
                            min="2"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.max_players}
                            onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dove</label>
                    <input
                        type="text"
                        required
                        placeholder="Nome del centro sportivo"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                </div>

                <button
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    {loading ? 'Creazione in corso...' : 'PUBBLICA PARTITA'}
                </button>
            </form>
        </div>
    );
}