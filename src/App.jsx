import MatchCard from './components/MatchCard';

function App() {
  // Mock data: facciamo finta che questi dati arrivino da Supabase
  const matches = [
    {
      id: 1,
      sport: 'Padel',
      title: 'Doppio ignorante',
      datetime: '2026-04-20T18:30:00',
      location: 'Padel Club Arena',
      current_players: 3,
      max_players: 4
    },
    {
      id: 2,
      sport: 'Calcetto',
      title: 'Sfida Scapoli vs Ammogliati',
      datetime: '2026-04-21T21:00:00',
      location: 'Campetti Comunali',
      current_players: 10,
      max_players: 10
    }
  ];

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