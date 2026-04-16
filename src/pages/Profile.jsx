import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Profile({ session }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [myMatches, setMyMatches] = useState([]);
    const [myCreatedMatches, setMyCreatedMatches] = useState([]);

    useEffect(() => {
        if (!session?.user) return;

        async function getProfileData() {
            setLoading(true);

            // 1. Recupera dati del profilo
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            setProfile(profileData);

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

        getProfileData();
    }, [session]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (loading) return <div className="p-10 text-center uppercase font-black">Caricamento...</div>;

    return (
        <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
            {/* Header Profilo */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-4xl mb-4 border-4 border-white shadow-lg">
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        profile?.username?.charAt(0).toUpperCase()
                    )}
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight">{profile?.username}</h2>
                <p className="text-slate-400 text-sm font-bold"> 📍 {profile?.province} ({profile?.zip_code})</p>
            </div>

            {/* Info Account */}
            <div className="bg-slate-50 p-4 rounded-2xl mb-8 space-y-2 text-sm">
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
                <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-blue-600">Le mie prossime sfide</h3>
                <div className="space-y-3">
                    {myMatches.length > 0 ? (
                        myMatches.map((item) => (
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
                </div>
            </div>

            {/*Partite Create */}
            <div className="mb-8">
                <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-yellow-400">partite create</h3>
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
                </div>
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
        </div>
    );
}