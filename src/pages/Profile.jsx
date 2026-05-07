import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { normalizeProfileData } from './PagesUtils/utils';
import imageCompression from 'browser-image-compression';
import { AccordionItem, AccordionCreatedMatches, AccorditionReviews } from '../components/MatchesAccordion';
import { Loader, Info, MapPin } from 'lucide-react';
import UserLocationInput from '../components/UserLocationInput';
import LocationPicker from '../components/LocationPicker';

export default function Profile({ session }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [myMatches, setMyMatches] = useState([]);
    const [myCreatedMatches, setMyCreatedMatches] = useState([]);
    const [myReviews, setMyReviews] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [activeMatchCount, setActiveMatchCount] = useState(0);
    const [tooltipActive, setTooltipActive] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);

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
        role: '',
        business_address: '',
        lat: null,
        lng: null
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

        //Se l'utente è un centro sportivo, non carichiamo le partite a cui partecipa, ma solo quelle inerenti al suo centro.
        if (profileData?.role === 'center') {
            setLoading(false);
            return;
        }

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
                 location,
                 creator_id
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

        // 3.5 Conta le partite attive (datetime > now)
        const now = new Date().toISOString();
        const activeMatches = (createdMatchesData || []).filter(match => match.datetime > now);
        setActiveMatchCount(activeMatches.length);

        // 4. Recupera le recensioni ricevute
        const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select(`
                rating,
                comment,
                created_at,
                reviewer:reviewer_id ( username, avatar_url, id )
            `)
            .eq('target_id', session.user.id)
            .order('created_at', { ascending: false });

        if (reviewsError) {
            console.warn('Errore caricamento recensioni:', reviewsError.message);
        }

        setMyReviews(reviewsData || []);
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
                favorite_sport: editData.favorite_sport,
                business_address: editData.business_address,
                lat: editData.lat,
                lng: editData.lng
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

    const hasConsentToDataProcessing = Boolean(
        profile?.data_consent ?? session.user?.user_metadata?.data_consent
    );

    const saveBusinessAddress = async (locationData) => {
        const { error } = await supabase
            .from('profiles')
            .update({
                business_address: locationData.location,
                lat: locationData.location_lat,
                lng: locationData.location_lng
            })
            .eq('id', user.id);

        if (!error) {
            success("Indirizzo salvato!");
            setIsEditingAddress(false);
        }
    };

    // if (loading) return <div className="p-10 text-center uppercase font-black">Caricamento...</div>;
    if (loading && !isEditing) return <div className="p-10 flex flex-col items-center text-center uppercase  font-black"><Loader size={56} strokeWidth={1.75} color="blue" className='loader-spin' /><span>attendi...</span></div>;

    // Se è un centro sportivo, mostriamo una dashboard semplificata con accesso alla gestione del centro
    if (profile?.role === 'center') {
        return (
            <>
                <div className="max-w-md mx-auto p-6 min-h-screen bg-white">


                    {!isEditing && (
                        <>
                            <div className='space-y-6'>
                                <button
                                    onClick={() => navigate(-1)}
                                    type="button"
                                    className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    TORNA INDIETRO
                                </button>
                                <h1 className="text-2xl font-black mb-4">Dashboard Centro Sportivo</h1>
                                <p className="text-slate-600 mb-6">Ciao {profile.username}, questa è la tua dashboard dedicata alla gestione del centro sportivo. Qui potrai creare e gestire le partite, visualizzare le prenotazioni e interagire con i tuoi clienti.</p>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full text-sm uppercase flex items-center justify-center p-2 cursor-pointer bg-blue-600 text-white border border-blue-800 py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    Vai alla Dashboard
                                </button>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="w-full text-sm uppercase flex items-center justify-center p-2 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    MODIFICA PROFILO
                                </button>
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="w-full text-sm uppercase flex items-center justify-center p-2 cursor-pointer bg-slate-600 text-white border border-slate-800 py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all active:scale-95"
                                >
                                    IMPOSTAZIONI APP
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-4 bg-red-50 text-red-600 font-black rounded-2xl shadow-md border border-red-600 flex items-center justify-center hover:bg-red-100 transition-all uppercase tracking-widest text-xs"
                                >
                                    Logout
                                </button>
                            </div>
                        </>
                    )}

                    {isEditing && (
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

                                {profile?.role === 'center' ? (
                                    <>
                                        {/* Sezione Indirizzo Business nel Profilo Centro */}
                                        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm mt-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase">
                                                    <MapPin size={16} className="text-blue-600" /> Sede del Centro
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingAddress(!isEditingAddress)}
                                                    className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full"
                                                >
                                                    {isEditingAddress ? 'Chiudi Mappa' : 'Modifica Posizione'}
                                                </button>
                                            </div>

                                            {isEditingAddress ? (
                                                <div className="space-y-4 min-h-[300px]">
                                                    <LocationPicker
                                                        value={{
                                                            location: editData.business_address,
                                                            location_lat: editData.lat,
                                                            location_lng: editData.lng
                                                        }}
                                                        onChange={(locationData) => setEditData({
                                                            ...editData,
                                                            business_address: locationData.location,
                                                            lat: locationData.location_lat,
                                                            lng: locationData.location_lng
                                                        })}
                                                    />
                                                    <p className="text-[10px] text-slate-400 italic">
                                                        * Trascina il marker sulla mappa per la massima precisione
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                    <p className="text-sm text-slate-600">
                                                        {profile.business_address || "Nessun indirizzo impostato"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}




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
                    )}


                </div>
            </>

        );
    } else {
        // Se è un giocatore, mostriamo il profilo completo con partite e recensioni
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
                            <div className="flex justify-between">
                                <span className="text-slate-400 font-bold uppercase text-[10px]">Sport Preferito</span>
                                <span className="font-bold">{profile?.favorite_sport}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2 items-center">
                                <div className="flex items-center gap-1">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Partite Attive</span>
                                    <div className="relative cursor-help">
                                        <button
                                            type="button"
                                            onClick={() => setTooltipActive(!tooltipActive)}
                                            className="p-1 hover:opacity-70 transition-opacity"
                                        >
                                            <Info size={14} className="text-slate-400" />
                                        </button>
                                        {tooltipActive && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs rounded px-2 py-1 max-w-xs z-10 animate-fade-in whitespace-normal text-center">
                                                Puoi avere max 5 partite attive contemporaneamente
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className={`font-black text-sm ${activeMatchCount >= 5 ? 'text-red-600' : 'text-blue-600'}`}>{activeMatchCount}/5</span>
                            </div>
                        </div>

                        {/* Le Mie Partite */}
                        <div className="mb-8">
                            <AccordionItem
                                title={"Prossime Partite"}
                                matches={myMatches
                                    .filter((item) => new Date(item.matches.datetime) > new Date())
                                    .sort((a, b) => new Date(a.matches.datetime) - new Date(b.matches.datetime))
                                    .map((item) => ({
                                        ...item,
                                        isCreator: item.matches.creator_id === session.user.id
                                    }))
                                }
                                isOpen={true}
                                titleColor="text-blue-600"
                                userId={session.user.id}
                            />
                        </div>

                        {/*Partite Create */}
                        <div className="mb-8">
                            <AccordionCreatedMatches title={"Partite Create"} matches={myCreatedMatches} isOpen={false} isCreatedMatches={true} />
                        </div>

                        {/*Partite Passate */}
                        <div className="mb-8">
                            <AccordionItem title={"Partite Passate"} matches={myMatches.filter((item) => new Date(item.matches.datetime) < new Date())} isOpen={false} titleColor="text-red-600" opacity="opacity-30" />
                        </div>

                        {/*Recensioni ricevute*/}
                        <div className="mb-8">
                            <AccorditionReviews title={"Recensioni Ricevute"} reviews={myReviews.filter((item) => new Date(item.created_at) < new Date())} isOpen={false} />
                        </div>

                        {/* Pulsanti Azione */}
                        <div className="space-y-3">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full text-sm uppercase flex items-center justify-center p-2 cursor-pointer bg-yellow-50 text-yellow-600 border border-yellow-600 py-4 rounded-2xl font-bold shadow-lg shadow-black-200 hover:bg-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                MODIFICA PROFILO
                            </button>
                            <button
                                onClick={() => navigate('/settings')}
                                className="w-full text-sm uppercase flex items-center justify-center p-2 cursor-pointer bg-slate-600 text-white border border-slate-800 py-4 rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all active:scale-95"
                            >
                                IMPOSTAZIONI APP
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full py-4 bg-red-50 text-red-600 font-black rounded-2xl shadow-md border border-red-600 flex items-center justify-center hover:bg-red-100 transition-all uppercase tracking-widest text-xs"
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
}

