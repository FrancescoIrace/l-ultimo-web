import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import MatchCard from './components/matchcard';

function App() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    async function getMatches() {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('datetime', { ascending: true });
      
      if (data) setMatches(data);
    }
    getMatches();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter">L'ULTIMO</h1>
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500">
            FC
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto p-4 pb-24">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Partite vicino a te
        </h2>
        
        <div className="grid gap-4">
          {matches.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </main>

      {/* Floating Action Button (Per creare nuove partite) */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl font-light hover:bg-blue-700 transition-transform active:scale-95">
        +
      </button>
    </div>
  );
}

export default App;