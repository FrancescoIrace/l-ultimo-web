import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function WelcomeModal({ onClose, username }) {
  const [isVisible, setIsVisible] = useState(true);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommits = async () => {
      try {
        const response = await fetch('/commits.json');
        if (!response.ok) throw new Error('File non trovato');
        
        const commits = await response.json();
        setUpdates(commits.slice(0, 5));
        setLoading(false);
      } catch (error) {
        console.log('Errore lettura commit:', error);
        // Se c'è errore, usa aggiornamenti di default
        setUpdates([
          {
            date: '20 Aprile 2026',
            title: 'Dinamica Giocatori per Sport',
            description: 'Il numero di giocatori ora si aggiorna automaticamente'
          },
          {
            date: '18 Aprile 2026',
            title: 'Nuova UI Form Creazione Match',
            description: 'Redesign della pagina di creazione partite'
          }
        ]);
        setLoading(false);
      }
    };

    fetchCommits();
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50 pointer-events-none">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto pointer-events-auto">
        {/* Header con close button */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase">Benvenuto, {username}! 👋</h2>
            <p className="text-sm text-slate-500 mt-1">Ultime modifiche all'app</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Lista aggiornamenti */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-sm text-slate-500 mt-3">Caricamento aggiornamenti...</p>
            </div>
          ) : (
            updates.map((update, idx) => (
              <div key={idx} className="pb-4 border-b border-slate-100 last:border-b-0">
                <div className="flex gap-3">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-blue-600 rounded-full mt-1"></div>
                    {idx < updates.length - 1 && (
                      <div className="w-0.5 h-12 bg-slate-200 mt-2"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                      {update.date}
                    </p>
                    <h3 className="text-sm font-bold text-slate-800 mt-1">
                      {update.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {update.description}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action button */}
        <button
          onClick={handleClose}
          className="w-full mt-8 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors active:scale-95"
        >
          Inizia a giocare! ⚽
        </button>

        <p className="text-xs text-slate-400 text-center mt-3">
          Questo messaggio verrà mostrato una volta al giorno
        </p>
      </div>
    </div>
  );
}
