import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { normalizeProfileData } from './PagesUtils/utils';
import imageCompression from 'browser-image-compression';
import { AccordionItem, AccordionCreatedMatches } from '../components/MatchesAccordion';
import { Loader } from 'lucide-react';
import UserLocationInput from '../components/UserLocationInput';

export default function Profile({ session }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [myMatches, setMyMatches] = useState([]);
    const [myCreatedMatches, setMyCreatedMatches] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    // Stato per il form di modifica
    const [editData, setEditData] = useState({
        username: '',
        full_name: '',
        province: '',
        zip_code: '',
        gender: '',
        location: '',
        location_lat: null,
        location_lng: null,
        updated_at: '',
        avatar_url: '',
        favorite_sport: '',
    });

        const handleSportChange = (e) => {
        const selectedSport = e.target.value;
        setEditData({
            ...editData,
            favorite_sport: selectedSport
        });
    };

    async function fetchAllData() {
        setLoading(true);

        // 1. Recupera dati del profilo
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        setProfile(profileData);
        setEditData(normalizeProfileData(profileData)); // Pre-compila il form con i dati attuali del profilo

        // 2. Recupera le partite a cui l'utente partecipa
        const { data: matchesData } = await supabase
            .from('participants')
            .select(`
                 match_id,
                 matches (
                 id,
                 title,
                 sport,
                 datetime,
                 location
                )
              `)
            .eq('user_id', session.user.id);

        setMyMatches(matchesData || []);

        // 3. Recupera le partite create dall'utente
        const { data: createdMatchesData } = await supabase
            .from('matches')
            .select('*')
            .eq('creator_id', session.user.id);

        setMyCreatedMatches(createdMatchesData || []);
        setLoading(false);
    }

    // 2. Lo useEffect ora chiama semplicemente la funzione esterna
    useEffect(() => {
        if (session?.user) {
            fetchAllData();
        }
    }, [session]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase
            .from('profiles')
            .update({
                username: editData.username,
                full_name: editData.full_name,
                province: editData.province,
                zip_code: editData.zip_code,
                gender: editData.gender,
                location: editData.location,
                location_lat: editData.location_lat,
                location_lng: editData.location_lng,
                updated_at: new Date(),
                avatar_url: editData.avatar_url,
                favorite_sport: editData.favorite_sport
            })
            .eq('id', session.user.id);

        if (error) {
            alert("Errore nell'aggiornamento: " + error.message);
        } else {
            alert("Profilo aggiornato con successo!");
            // setIsEditing(false);
            // fetchAllData(); // Ricarica i dati aggiornati
            setProfile(editData);
            setIsEditing(false);
        }
        setLoading(false);
    };

    const uploadAvatar = async (event) => {
        try {
            setLoading(true);
            const originalFile = event.target.files[0]; // Usiamo un nome chiaro

            if (!originalFile) return;

            // Opzioni di compressione
            const options = {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 500,
                useWebWorker: true
            };

            // Creiamo una NUOVA variabile per il file compresso
            const compressedFile = await imageCompression(originalFile, options);

            // Usiamo un nome fisso per l'utente, così ogni upload sovrascrive il precedente
            // Esempio: "ID_UTENTE/avatar.png"
            const fileName = `${session.user.id}/avatar.png`;
            // 1. Upload del file COMPRESSO
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressedFile, {
                    upsert: true // <--- FONDAMENTALE: permette di sovrascrivere il file esistente
                });
            if (uploadError) throw uploadError;

            // 2. Ottieni l'URL pubblico
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // Aggiungiamo ?t=timestamp per forzare il browser a mostrare la nuova immagine 
            // anche se il nome del file è identico
            const finalUrl = `${publicUrl}?t=${Date.now()}`;

            // SALVA NELLO STATO L'URL PULITO
            setEditData(prev => ({
                ...prev,
                avatar_url: publicUrl
            }));

            // 3. Aggiorna lo stato per l'anteprima
            // setEditData({ ...editData, avatar_url: finalUrl });

        } catch (error) {
            alert("Errore caricamento immagine: " + error.message);
        } finally {
            alert("Immagine caricata con successo!");
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    // if (loading) return <div className="p-10 text-center uppercase font-black">Caricamento...</div>;
    if (loading && !isEditing) return <div className="p-10 flex flex-col items-center text-center uppercase  font-black"><Loader size={56} strokeWidth={1.75} color="blue" className='loader-spin' /><span>attendi...</span></div>;

    return (
        <div className="max-w-md mx-auto p-6 min-h-screen bg-white">
            {!isEditing ? (
                <>
                    {/* --- SEZIONE PROFILO --- */}

                    {/* Header Profilo */}
                    <button
                        onClick={() => navigate(-1)}
                        type="button"
                        className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        TORNA INDIETRO
                    </button>
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-white shadow-lg">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                profile?.username?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">{profile?.username}</h2>
                        <p className="text-slate-400 text-sm font-bold">
                            📍 {profile?.location || profile?.province}
                            {profile?.location ? ` (${profile?.zip_code})` : ''}
                        </p>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-auto h-10 text-sm uppercase flex items-center justify-center p-2 mt-4 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            MODIFICA PROFILO
                        </button>
                    </div>

                    {/* Info Account */}
                    <div className="bg-slate-50 p-4 rounded-2xl mb-8 space-y-2 text-sm relative">
                        <span className="text-slate-400 font-bold uppercase text-[10px] top-0 left-25 absolute">📅 Profilo creato il {new Date(session?.user.created_at).toLocaleDateString('it-IT')}</span>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Genere</span>
                            <span className="font-bold">{profile?.gender === 'M' ? 'Uomo' : profile?.gender === 'F' ? 'Donna' : 'Altro'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Email</span>
                            <span className="font-bold">{session.user.email}</span>
                        </div>
                    </div>

                    {/* Le Mie Partite */}
                    <div className="mb-8">
                        <AccordionItem title={"Prossime Partite"} matches={myMatches.filter((item) => new Date(item.matches.datetime) > new Date())} isOpen={true} titleColor="text-blue-600" />
                        {/* <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-blue-600">Le mie prossime sfide</h3>
                        <div className="space-y-3">
                            {myMatches.length > 0 ? (
                                myMatches
                                    .filter((item) => new Date(item.matches.datetime) > new Date())
                                    .map((item) => (
                                        <div
                                            key={item.matches.id}
                                            onClick={() => navigate(`/match/${item.matches.id}`)}
                                            className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-black uppercase text-sm">{item.matches.title || item.matches.sport}</p>
                                                    <p className="text-xs text-slate-500">{new Date(item.matches.datetime).toLocaleDateString()}</p>
                                                </div>
                                                <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">
                                                    {item.matches.sport}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                <p className="text-slate-400 text-sm italic">Non sei ancora iscritto a nessuna partita.</p>
                            )}
                        </div> */}
                    </div>

                    {/*Partite Create */}
                    <div className="mb-8">
                        <AccordionCreatedMatches title={"Partite Create"} matches={myCreatedMatches} isOpen={false} isCreatedMatches={true} />
                        {/* <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-yellow-400">partite create</h3>
                        <div className="space-y-3">
                            {myCreatedMatches.length > 0 ? (
                                myCreatedMatches.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => navigate(`/match/${item.id}`)}
                                        className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-black uppercase text-sm">{item.title || item.sport}</p>
                                                <p className="text-xs text-slate-500">{new Date(item.datetime).toLocaleDateString()}</p>
                                            </div>
                                            <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">
                                                {item.sport}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm italic">Non hai ancora creato nessuna partita.</p>
                            )}
                        </div> */}
                    </div>

                    {/*Partite Passate */}
                    <div className="mb-8">
                        {/* <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-yellow-400">partite passate</h3> */}
                        <AccordionItem title={"Partite Passate"} matches={myMatches.filter((item) => new Date(item.matches.datetime) < new Date())} isOpen={false} titleColor="text-red-600" />
                        {/* <div className="space-y-3">
                            {myMatches.length > 0 ? (
                                myMatches
                                    .filter((item) => new Date(item.matches.datetime) < new Date())
                                    .map((item) => (
                                        <div
                                            key={item.matches.id}
                                            onClick={() => navigate(`/match/${item.matches.id}`)}
                                            className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-black uppercase text-sm">{item.matches.title || item.matches.sport}</p>
                                                    <p className="text-xs text-slate-500">{new Date(item.matches.datetime).toLocaleDateString()}</p>
                                                </div>
                                                <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">
                                                    {item.matches.sport}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                <p className="text-slate-400 text-sm italic">Non hai partecipato ancora a nessuna partita.</p>
                            )}
                        </div> */}
                    </div>

                    {/* Pulsanti Azione */}
                    <div className="space-y-3">
                        <button
                            onClick={handleLogout}
                            className="w-full py-4 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-all uppercase tracking-widest text-xs"
                        >
                            Logout
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* --- FORM DI MODIFICA --- */}
                    <h2 className="text-2xl font-black mb-6 uppercase">Modifica Dati</h2>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        {/* Foto */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 bg-slate-200 rounded-full mb-3 overflow-hidden border-2 border-blue-500">
                                {/* {profile.avatar_url ? (
                                    <img src={} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">📸</div>
                                )} */}
                                {editData.avatar_url ? (
                                    <img
                                        // src={editData.avatar_url}
                                        src={`${editData.avatar_url}?t=${Date.now()}`} // Il timestamp lo mettiamo solo qui!
                                        className="w-full h-full object-cover"
                                        alt="Anteprima avatar"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 font-black">
                                        {editData.username?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                )}
                            </div>
                            <label className="cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-yellow-100">
                                CAMBIA FOTO
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={uploadAvatar}
                                    disabled={loading}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Username */}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Username</label>
                            <input
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={editData.username ?? ''}
                                onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                            />
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Full Name</label>
                            <input
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={editData.full_name ?? ''}
                                onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                            />
                        </div>

                        {/* Posizione di base */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-slate-700 mb-2">Posizione di base</p>
                            <UserLocationInput
                                value={{
                                    location: editData.location ?? '',
                                    province: editData.province,
                                    zip_code: editData.zip_code,
                                }}
                                onChange={(value) => setEditData({ ...editData, ...value })}
                            />
                        </div>

                        {/* Genere */}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Genere</label>
                            <select
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={editData.gender ?? 'Other'}
                                onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                            >
                                <option value="M">Uomo</option>
                                <option value="F">Donna</option>
                                <option value="Other">Altro</option>
                            </select>
                        </div>

                        {/* Sport preferito */}
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sport preferito</label>
                            <select
                                className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                value={editData.favorite_sport ?? 'Calcetto'}
                                onChange={(e) => handleSportChange(e)}
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

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="flex-1 p-3 uppercase cursor-pointer bg-slate-100 text-slate-600 border border-slate-600 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Annulla
                            </button>
                            <button
                                type="submit"
                                className="flex-1 p-3 uppercase cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Salva
                            </button>
                        </div>
                        <div>
                            <span className='text-slate-400'>Ultima modifica: {profile.updated_at ? new Date(profile.updated_at).toLocaleDateString('it-IT') : 'N/A'} alle {profile.updated_at ? new Date(profile.updated_at).toLocaleTimeString('it-IT').slice(0, 5) : 'N/A'}</span>
                        </div>
                    </form>
                </>
            )
            }
        </div>
    );
}