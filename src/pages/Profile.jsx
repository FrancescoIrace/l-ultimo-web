import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { normalizeProfileData } from './PagesUtils/utils';
import imageCompression from 'browser-image-compression';
import { AccordionItem, AccordionCreatedMatches, AccorditionReviews } from '../components/MatchesAccordion';
import { Loader, Info, MapPin, Mail, User, Dumbbell, CalendarDays, Trophy, PencilLine, Settings, LogOut, ChevronRight, ShieldCheck, Users } from 'lucide-react';
import UserLocationInput from '../components/UserLocationInput';
import LocationPicker from '../components/LocationPicker';
import { useAlert } from '../components/AlertComponent';

export default function Profile({ session }) {
    const { success, error: showAlertError } = useAlert();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [myMatches, setMyMatches] = useState([]);
    const [myCreatedMatches, setMyCreatedMatches] = useState([]);
    const [myReviews, setMyReviews] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [activeMatchCount, setActiveMatchCount] = useState(0);
    const [tooltipActive, setTooltipActive] = useState(false);
    const [friendCount, setFriendCount] = useState(0);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [squads, setSquads] = useState([]);

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
        avatar_url: null,
        favorite_sport: '',
        cellulare: '',
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
        console.log("Dati profilo caricati:", profileData);
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

        // 5. Conta gli amici
        const { count: friendsCount } = await supabase
            .from('friendships')
            .select('id', { count: 'exact', head: true })
            .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
            .eq('status', 'accepted');
        setFriendCount(friendsCount ?? 0);

        // 6. Recupera le squadre di cui fa parte
        const { data: squadsData } = await supabase
            .from('team_members')
            .select(`
                 team_id,
                 team:teams (
                 id,
                 name,
                 logo_url,
                 created_by
                )              
              `)
            .eq('user_id', session.user.id);

        setSquads(squadsData || []);

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
                cellulare: editData.cellulare,
                business_address: editData.business_address,
                lat: editData.lat,
                lng: editData.lng
            })
            .eq('id', session.user.id);

        if (error) {
            showAlertError("Errore nell'aggiornamento: " + error.message);
        } else {
            success("Profilo aggiornato con successo!");
            // setIsEditing(false);
            // fetchAllData(); // Ricarica i dati aggiornati
            setProfile({ ...profile, ...editData });
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

            success("Immagine caricata con successo!");

        } catch (error) {
            showAlertError("Errore caricamento immagine: " + error.message);
        } finally {
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
            .eq('id', session.user.id);

        if (!error) {
            success("Indirizzo salvato!");
            setIsEditingAddress(false);
        } else {
            showAlertError("Errore salvataggio indirizzo: " + error.message);
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
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Username</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                        value={editData.username ?? ''}
                                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                    />
                                </div>

                                {/* Full Name */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Full Name</label>
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
                                {/* <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Genere</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                        value={editData.gender ?? 'Other'}
                                        onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                                    >
                                        <option value="M">Uomo</option>
                                        <option value="F">Donna</option>
                                        <option value="Other">Altro</option>
                                    </select>
                                </div> */}

                                {/* Telefono */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Telefono</label>
                                    <input
                                        type="text"
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                        value={editData.cellulare ?? ''}
                                        onChange={(e) => setEditData({ ...editData, cellulare: e.target.value })}
                                    />
                                </div>

                                {/* Sport preferito */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Sport preferito</label>
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
            <div className="max-w-md mx-auto pb-24 min-h-screen bg-slate-100">
                {!isEditing ? (
                    <>
                        {/* ── HEADER ── */}
                        <div className="bg-white px-6 pt-6 pb-5 mb-4">
                            <button
                                onClick={() => navigate(-1)}
                                type="button"
                                className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                            >
                                <ChevronRight size={14} className="rotate-180" />
                                Indietro
                            </button>

                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-3xl font-black text-blue-600 border-4 border-white shadow-lg overflow-hidden">
                                    {profile?.avatar_url
                                        ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        : profile?.username?.charAt(0).toUpperCase()
                                    }
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-tight">{profile?.username}</h2>
                                    <p className="text-slate-400 text-xs font-bold mt-0.5">
                                        📍 {profile?.location || profile?.province}
                                        {profile?.location && profile?.zip_code ? ` (${profile.zip_code})` : ''}
                                    </p>
                                    <p className="text-slate-300 text-[10px] font-bold mt-1 uppercase">
                                        Iscritto il {new Date(session?.user.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {/* Stats row */}
                            <div className="flex items-center rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 shadow-sm">
                                <button
                                    onClick={() => navigate('/richieste-amici', { state: { tab: 'friends' } })}
                                    className="flex-1 flex flex-col items-center py-3 border-r border-slate-100 hover:bg-blue-50 transition active:scale-95"
                                >
                                    <span className="text-xl font-black text-slate-800">{friendCount}</span>
                                    <span className="text-[10px] font-bold uppercase text-blue-500 tracking-wide">Amici</span>
                                </button>
                                <div className="flex-1 flex flex-col items-center py-3 border-r border-slate-100">
                                    <span className="text-xl font-black text-slate-800">{myReviews.length}</span>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Recensioni</span>
                                </div>
                                <div className="flex-1 flex flex-col items-center py-3">
                                    <span className="text-xl font-black text-yellow-500">
                                        {myReviews.length > 0
                                            ? (myReviews.reduce((acc, r) => acc + r.rating, 0) / myReviews.length).toFixed(1)
                                            : '—'}
                                    </span>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Media voti</span>
                                </div>
                            </div>
                        </div>

                        {/* ── INFO CARD ── */}
                        <div className="mx-4 mb-4 bg-white rounded-3xl shadow-sm overflow-hidden">
                            <div className="px-4 pt-4 pb-2">
                                <p className="text-[14px] font-black uppercase text-slate-400 tracking-widest mb-3">Dati Account</p>
                            </div>
                            {[
                                { icon: <Mail size={15} className="text-blue-500" />, label: 'Email', value: session.user.email },
                                { icon: <User size={15} className="text-purple-500" />, label: 'Genere', value: profile?.gender === 'M' ? 'Uomo' : profile?.gender === 'F' ? 'Donna' : 'Altro' },
                                { icon: <Dumbbell size={15} className="text-green-500" />, label: 'Sport preferito', value: profile?.favorite_sport || '—' },
                                { icon: <ShieldCheck size={15} className="text-slate-400" />, label: 'Stato account', value: 'Attivo' },
                            ].map(({ icon, label, value }, i, arr) => (
                                <div key={label} className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-slate-50' : 'pb-4'}`}>
                                    <div className="w-7 flex justify-center">{icon}</div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide w-28 shrink-0">{label}</span>
                                    <span className="font-bold text-slate-800 text-sm truncate">{value}</span>
                                </div>
                            ))}

                            {/* Partite attive con barra progresso */}
                            <div className="px-4 pt-3 pb-4 border-t border-slate-50">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <Trophy size={15} className={activeMatchCount >= 5 ? 'text-red-500' : 'text-amber-500'} />
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Partite attive</span>
                                        <button
                                            type="button"
                                            onClick={() => setTooltipActive(!tooltipActive)}
                                            className="hover:opacity-70 transition-opacity"
                                        >
                                            <Info size={13} className="text-slate-300" />
                                        </button>
                                        {tooltipActive && (
                                            <div className="absolute mt-8 ml-4 bg-slate-900 text-white text-xs rounded-xl px-3 py-1.5 z-10 shadow-lg">
                                                Massimo 5 partite attive contemporaneamente
                                            </div>
                                        )}
                                    </div>
                                    <span className={`font-black text-sm ${activeMatchCount >= 5 ? 'text-red-600' : 'text-blue-600'}`}>{activeMatchCount}/5</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${activeMatchCount >= 5 ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: `${(activeMatchCount / 5) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── SQUADS (SOLO SE HA SQUADS) ── */}
                        {squads.length > 0 && (
                            <div className="mx-4 mb-4 p-4 bg-white rounded-3xl shadow-sm overflow-hidden">
                                <div className="mb-5 flex items-center">
                                    <p className="text-[14px] font-black uppercase text-slate-400 tracking-widest mb-3">Le mie squadre</p>
                                    <p className='ml-auto text-[14px] font-black uppercase font-black text-blue-600 tracking-widest mb-3'>({squads.length})</p>
                                </div>
                                {squads.map((squad) => (
                                    <div
                                        key={squad.team_id}
                                        onClick={() => navigate(`/squadre/${squad.team_id}`)}
                                        className="flex justify-left bg-slate-50 gap-3 px-4 py-3 mb-3 shadow-md border border-slate-300 rounded-3xl items-center cursor-pointer hover:bg-slate-100 transition hover:scale-101"
                                    >
                                        <div className="w-10 flex justify-center">
                                            {squad.team.logo_url ? (
                                                <img
                                                    src={squad.team.logo_url}
                                                    alt={squad.team.name}
                                                    className="w-full h-full object-cover rounded-xl"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-600 text-[18px] font-bold uppercase">
                                                    {squad.team.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-800 text-[16px]">{squad.team.name}</span>
                                        </div>
                                        {squad.team.created_by === session.user.id && (
                                            <div className="ml-auto">
                                                <span className="text-[10px] font-bold uppercase text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">Creatore</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── NAVIGAZIONE PARTITE ── */}
                        <div className="mx-4 mb-4">
                            <button
                                onClick={() => navigate('/le-mie-partite')}
                                className="w-full bg-white rounded-3xl shadow-sm px-4 py-4 flex items-center gap-3 hover:bg-slate-50 transition active:scale-95"
                            >
                                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                                    <CalendarDays size={18} className="text-blue-600" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-black text-slate-800 text-sm">Le mie partite</p>
                                    <p className="text-xs text-slate-400">Prossime, create e passate</p>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </button>
                        </div>

                        {/* ── PARTITE PROSSIME (solo anteprima) ── */}
                        <div className="mx-4 mb-4">
                            <AccordionItem
                                title="Prossime Partite"
                                matches={myMatches
                                    .filter(item => new Date(item.matches.datetime) > new Date())
                                    .sort((a, b) => new Date(a.matches.datetime) - new Date(b.matches.datetime))
                                    .map(item => ({ ...item, isCreator: item.matches.creator_id === session.user.id }))
                                }
                                isOpen={true}
                                titleColor="text-blue-600"
                                userId={session.user.id}
                            />
                        </div>

                        {/* ── RECENSIONI ── */}
                        <div className="mx-4 mb-6">
                            <AccorditionReviews
                                title="Recensioni Ricevute"
                                reviews={myReviews}
                                isOpen={false}
                            />
                        </div>

                        {/* ── AZIONI ── */}
                        <div className="mx-4 grid grid-cols-2 gap-3 mb-4">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="cursor-pointer bg-gradient-to-br from-yellow-400 to-yellow-500 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg shadow-black/10 hover:shadow-xl transition-all active:scale-95"
                            >
                                <PencilLine size={22} />
                                Modifica Profilo
                            </button>
                            <button
                                onClick={() => navigate('/settings')}
                                className="cursor-pointer bg-gradient-to-br from-slate-600 to-slate-700 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg shadow-black/10 hover:shadow-xl transition-all active:scale-95"
                            >
                                <Settings size={22} />
                                Impostazioni
                            </button>
                        </div>
                        <div className="mx-4 mb-8">
                            <button
                                onClick={handleLogout}
                                className="w-full cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-2xl font-bold text-sm flex flex-col items-center gap-2 shadow-lg shadow-black/10 hover:shadow-xl transition-all active:scale-95"
                            >
                                <LogOut size={22} />
                                Logout
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* --- FORM DI MODIFICA --- */}
                        <div className="bg-white px-6 pt-6 pb-8">
                            <h2 className="text-2xl font-black mb-6 uppercase">Modifica Dati</h2>
                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                {/* Foto */}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="w-20 h-20 bg-slate-200 rounded-full mb-3 overflow-hidden border-2 border-blue-500">
                                        {editData.avatar_url ? (
                                            <img
                                                src={`${editData.avatar_url}?t=${Date.now()}`}
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
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Username</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                        value={editData.username ?? ''}
                                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                    />
                                </div>

                                {/* Full Name */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Full Name</label>
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
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Genere</label>
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

                                {/* Cellulare */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Cellulare</label>
                                    <input
                                        className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold"
                                        value={editData.cellulare ?? ''}
                                        onChange={(e) => setEditData({ ...editData, cellulare: e.target.value })}
                                    />
                                </div>

                                {/* Sport preferito */}
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 ml-2 mb-1.5 block">Sport preferito</label>
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
                                        className="flex-1 p-4 uppercase cursor-pointer bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 p-4 uppercase cursor-pointer bg-gradient-to-br from-yellow-400 to-yellow-500 text-white rounded-2xl font-bold shadow-lg shadow-black/10 hover:shadow-xl transition-all active:scale-95"
                                    >
                                        Salva
                                    </button>
                                </div>
                                <p className="text-xs text-slate-300 text-center pt-1">
                                    Ultima modifica: {profile.updated_at
                                        ? `${new Date(profile.updated_at).toLocaleDateString('it-IT')} alle ${new Date(profile.updated_at).toLocaleTimeString('it-IT').slice(0, 5)}`
                                        : 'N/A'}
                                </p>
                            </form>
                        </div>
                    </>
                )
                }
            </div>
        );
    }
}

