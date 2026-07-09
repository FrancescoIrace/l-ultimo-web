import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AccordionItem, AccordionCreatedMatches } from '../components/MatchesAccordion';
import { ChevronLeft } from 'lucide-react';
import Loader from '../components/Loader';

export default function MyMatches({ session }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [myMatches, setMyMatches] = useState([]);
    const [myCreatedMatches, setMyCreatedMatches] = useState([]);

    useEffect(() => {
        async function loadMatches() {
            setLoading(true);

            const [{ data: participantData }, { data: createdData }] = await Promise.all([
                supabase
                    .from('participants')
                    .select(`
                        match_id,
                        matches (
                            id, title, sport, datetime, location, creator_id
                        )
                    `)
                    .eq('user_id', session.user.id),
                supabase
                    .from('matches')
                    .select('*')
                    .eq('creator_id', session.user.id)
                    .order('datetime', { ascending: false }),
            ]);

            setMyMatches(participantData || []);
            setMyCreatedMatches(createdData || []);
            setLoading(false);
        }

        if (session?.user) loadMatches();
    }, [session]);

    if (loading) {
        return (
            <Loader variant="page" />
        );
    }

    // item.matches può tornare null (es. RLS che filtra la partita per
    // questo utente pur lasciando visibile la riga participants): senza
    // questo filtro qualunque accesso a item.matches.datetime crasherebbe
    // l'intera pagina.
    const validJoined = myMatches.filter(item => item.matches);

    const upcomingJoined = validJoined
        .filter(item => new Date(item.matches.datetime) > new Date())
        .sort((a, b) => new Date(a.matches.datetime) - new Date(b.matches.datetime))
        .map(item => ({ ...item, isCreator: item.matches.creator_id === session.user.id }));

    const pastJoined = validJoined
        .filter(item => new Date(item.matches.datetime) < new Date())
        .sort((a, b) => new Date(b.matches.datetime) - new Date(a.matches.datetime));

    return (
        <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100 min-h-screen">
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition"
            >
                <ChevronLeft size={16} />
                Indietro
            </button>

            <h1 className="text-3xl font-black text-slate-900 mb-6">Le mie partite</h1>

            <div className="space-y-4">
                <AccordionItem
                    title="Prossime Partite"
                    matches={upcomingJoined}
                    isOpen={true}
                    titleColor="text-blue-600"
                    userId={session.user.id}
                />

                <AccordionCreatedMatches
                    title="Partite Create"
                    matches={myCreatedMatches}
                    isOpen={false}
                    isCreatedMatches={true}
                />

                <AccordionItem
                    title="Partite Passate"
                    matches={pastJoined}
                    isOpen={false}
                    titleColor="text-red-600"
                    opacity="opacity-30"
                    userId={session.user.id}
                />
            </div>
        </main>
    );
}
