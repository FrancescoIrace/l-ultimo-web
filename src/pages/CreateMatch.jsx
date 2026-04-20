import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import LocationPicker from '../components/LocationPicker';



export default function CreateMatch() {
    const { id } = useParams(); // Se c'è un ID, siamo in modalità modifica
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        sport: 'Calcetto',
        title: '',
        datetime: '',
        location: '',
        location_lat: null,
        location_lng: null,
        max_players: 10, // Default per Calcetto
        description: ''
    });

    const SPORT_MAX_PLAYERS = {
        'Calcetto': 10,
        'Calcio a 7': 14,
        'Calcio a 11': 22,
        'Padel': 4,
        'Basket (3vs3)': 6,
        'Basket (5vs5)': 10,
        'Tennis singolo': 2,
        'Tennis doppio': 4,
        'Volley': 12
    };

    const handleSportChange = (e) => {
        const selectedSport = e.target.value;
        setFormData({
            ...formData,
            sport: selectedSport,
            max_players: SPORT_MAX_PLAYERS[selectedSport]
        });
    };

    // 1. Se c'è un ID, carichiamo i dati attuali dal DB
    useEffect(() => {
        if (id) {
            async function loadMatchData() {
                const { data, error } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (data) {
                    console.log(data); setFormData(data);
                }
            }
            loadMatchData();
        }
    }, [id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Converti la data locale in UTC correttamente
        const localDate = new Date(formData.datetime);
        const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
        const datetimeUTC = utcDate.toISOString();

        // 1. Inseriamo la partita
        // .select() alla fine ci permette di ricevere indietro i dati appena creati
        const { data: newMatch, error: matchError } = await supabase
            .from('matches')
            .insert([
                {
                    ...formData,
                    datetime: datetimeUTC, // Usa la data convertita in UTC
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

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Converti la data locale in UTC correttamente
        const localDate = new Date(formData.datetime);
        const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
        const datetimeUTC = utcDate.toISOString();

        // 1. Aggiorniamo la partita esistente
        const { data: updatedMatch, error: matchError } = await supabase
            .from('matches')
            .update({
                title: formData.title,
                location: formData.location,
                location_lat: formData.location_lat,
                location_lng: formData.location_lng,
                datetime: datetimeUTC, // Usa la data convertita in UTC
                description: formData.description,
            })
            .eq('id', id)
            .select()
            .single();

        if (matchError) {
            alert("Errore aggiornamento partita: " + matchError.message);
            setLoading(false);
            return;
        }

        alert("Partita aggiornata con successo!");
        navigate('/match/' + id);
        setLoading(false);
    };

    if (id !== undefined && id !== null) {
        return (
            <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
                <button
                    onClick={() => navigate('/match/' + id)}
                    type="button"
                    className="w-60 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    TORNA ALLA PAGINA DEL MATCH
                </button>
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Modifica Match</h2>

                <form onSubmit={handleUpdate} className="space-y-5">
                    {/* SPORT */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sport</label>
                        <select
                            disabled
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
                            value={formData.sport}
                            onChange={handleSportChange}  // ← NUOVO
                        >
                            <option>Calcetto</option>
                            <option>Calcio a 7</option>
                            <option>Calcio a 11</option>
                            <option>Padel</option>
                            <option>Basket (3vs3)</option>
                            <option>Basket (5vs5)</option>
                            <option>Tennis singolo</option>
                            <option>Tennis doppio</option>
                            <option>Volley</option>
                        </select>
                    </div>

                    {/* TITOLO */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titolo (Opzionale)</label>
                        <input
                            type="text"
                            placeholder="Es: Partitella tra amici"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {/* DATA E GIOCATORI */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quando</label>
                            <input
                                type="datetime-local"
                                lang="it-IT"
                                required
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.datetime ? formData.datetime.slice(0, 16) : ''} // Formatta per input datetime-local
                                onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giocatori Totali</label>
                            <input
                                type="number"
                                required
                                disabled
                                min="2"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-50"
                                value={formData.max_players}
                                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* LUOGO E DESCRIZIONE */}
                    <LocationPicker 
                        value={formData}
                        onChange={(locationData) => setFormData({ ...formData, ...locationData })}
                    />

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrizione <i className="text-slate-400 text-[10px]">(max 300 caratteri)</i></label>
                        <textarea
                            placeholder="Descrizione della partita"
                            maxLength={300}
                            className="w-full h-50 resize-none p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <button
                        disabled={loading}
                        className="w-full mt-4 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Creazione in corso...' : 'SALVA MODIFICHE'}
                    </button>

                </form>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            <button
                onClick={() => navigate('/')}
                type="button"
                className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
            >
                TORNA INDIETRO
            </button>
            <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Organizza Match</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* SPORT */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sport</label>
                    <select
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.sport}
                        onChange={handleSportChange}
                    >
                        <option>Calcetto</option>
                        <option>Calcio a 7</option>
                        <option>Calcio a 11</option>
                        <option>Padel</option>
                        <option>Basket (3vs3)</option>
                        <option>Basket (5vs5)</option>
                        <option>Tennis singolo</option>
                        <option>Tennis doppio</option>
                        <option>Volley</option>
                    </select>
                </div>

                {/* TITOLO */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Titolo (Opzionale)</label>
                    <input
                        type="text"
                        placeholder="Es: Partitella tra amici"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                {/* DATA E GIOCATORI */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quando</label>
                        <input
                            type="datetime-local"
                            lang="it-IT"
                            //la data passata non è selezionabile
                            min={new Date().toISOString().slice(0, 16)}
                            required
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                        />
                    </div>
                    <div>
                        {/* Il numero di giocatori cambia in base allo sport (principalmente), quindi sull'onchange della select dello sport */}
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Giocatori Totali</label>
                        <input
                            type="number"
                            required
                            disabled
                            min="2"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.max_players}
                            onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                {/* LUOGO E DESCRIZIONE */}
                <LocationPicker 
                    value={formData}
                    onChange={(locationData) => setFormData({ ...formData, ...locationData })}
                />

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrizione <i className="text-slate-400 text-[10px]">(max 300 caratteri)</i></label>
                    <textarea
                        placeholder="Descrizione della partita"
                        maxLength={300}
                        className="w-full h-50 resize-none p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <button
                    disabled={loading}
                    className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                    {loading ? 'Creazione in corso...' : 'PUBBLICA PARTITA'}
                </button>

            </form>
        </div>
    );

}