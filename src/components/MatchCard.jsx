import { Calendar, MapPin, Users } from 'lucide-react';

export default function MatchCard({ match }) {
  // Calcoliamo se la partita è piena
  const isFull = match.current_players >= match.max_players;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
          {match.sport}
        </div>
        <span className={`text-xs font-medium ${isFull ? 'text-red-500' : 'text-green-500'}`}>
          {isFull ? 'PARTITA PIENA' : 'POSTI DISPONIBILI'}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-wide">
        {match.title || `Partita di ${match.sport}`}
      </h3>

      <div className="space-y-2 text-slate-600 text-sm">
        <div className="flex items-center gap-2">
          <Calendar size={16} />
          <span>{new Date(match.datetime).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} />
          <span>{match.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={16} />
          <span className="font-semibold">{match.current_players} / {match.max_players} Giocatori</span>
        </div>
      </div>

      <button className={`w-full mt-4 py-2 rounded-lg font-bold transition-colors ${
        isFull 
        ? 'bg-orange-500 text-white hover:bg-orange-600' 
        : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}>
        {isFull ? 'Mettiti in lista d\'attesa' : 'Unisciti alla partita'}
      </button>
    </div>
  );
}