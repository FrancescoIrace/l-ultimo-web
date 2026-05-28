import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Clock } from 'lucide-react';

export default function ModalOrari({ isOpen, onClose, centerId }) {
  const [hours, setHours] = useState([]);
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  useEffect(() => {
    if (isOpen) fetchHours();
  }, [isOpen]);

  async function fetchHours() {
    const { data } = await supabase.from('business_hours').select('*').eq('center_id', centerId).order('day_of_week');
    // Se la tabella è vuota, inizializziamo dei valori di default
    if (data?.length === 0) {
      setHours(days.map((_, i) => ({ day_of_week: i, open_time: '09:00', close_time: '22:00', is_closed: false })));
    } else {
      setHours(data);
    }
  }

  async function handleSave() {
    const { error } = await supabase.from('business_hours').upsert(
      hours.map(h => ({ ...h, center_id: centerId }))
    );
    if (!error) onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm dark:bg-slate-900/60 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] dark:bg-slate-800">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Orari Apertura</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Imposta quando i giocatori possono prenotare</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X /></button>
        </div>

        {/* Lista Giorni */}
        <div className="p-6 overflow-y-auto space-y-4">
          {hours.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
              <span className="font-bold text-slate-700 dark:text-slate-200 w-24">{days[item.day_of_week]}</span>
              
              <div className="flex items-center gap-2">
                <input 
                  type="time" 
                  value={item.open_time}
                  disabled={item.is_closed}
                  onChange={(e) => {
                    const newHours = [...hours];
                    newHours[index].open_time = e.target.value;
                    setHours(newHours);
                  }}
                  className="bg-white border rounded-lg p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:focus:ring-blue-500"
                />
                <span className="text-slate-400 dark:text-slate-500">-</span>
                <input 
                  type="time" 
                  value={item.close_time}
                  disabled={item.is_closed}
                  onChange={(e) => {
                    const newHours = [...hours];
                    newHours[index].close_time = e.target.value;
                    setHours(newHours);
                  }}
                  className="bg-white border rounded-lg p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 dark:focus:ring-blue-500"
                />
              </div>

              <button 
                onClick={() => {
                  const newHours = [...hours];
                  newHours[index].is_closed = !newHours[index].is_closed;
                  setHours(newHours);
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-colors ${item.is_closed ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'}`}
              >
                {item.is_closed ? 'Chiuso' : 'Aperto'}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-white dark:bg-slate-800">
          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={20} /> Salva Orari
          </button>
        </div>
      </div>
    </div>
  );
}