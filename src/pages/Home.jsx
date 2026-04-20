import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';
import MatchCard from '../components/MatchCard';
import MatchSkeleton from '../components/MatchSkeleton';
import PWADashboard from './PWADashboard';

export default function Home({ session, isPWA }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('datetime', { ascending: true });

      if (error) {
        console.error('Errore:', error);
      } else {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  if (isPWA) {
    return <PWADashboard user={session.user} onLogout={() => supabase.auth.signOut()} />;
  }

  return (
    <main className="max-w-md mx-auto p-4 pb-24 bg-slate-100">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Partite vicino a te
      </h2>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((n) => (
            <MatchSkeleton key={n} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {matches.length > 0 ? (
            matches.map((match) => <MatchCard key={match.id} match={match} user={session.user} />)
          ) : (
            <>
              <p className="text-center text-slate-500 mt-10">Nessuna partita trovata. Creane una tu!</p>

              <button
                disabled={loading}
                onClick={() => navigate('/organizza')}
                className="w-full cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Caricamento...' : 'Organizza una partita'}
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => navigate('/organizza')}
        className="fixed bottom-6 right-6 w-[80px] h-20 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center font-light hover:bg-blue-700 transition-transform active:scale-90 cursor-pointer"
      >
        <Plus size={60} strokeWidth={2.5} className='active:animate-spin' />
      </button>
    </main>
  );
}
