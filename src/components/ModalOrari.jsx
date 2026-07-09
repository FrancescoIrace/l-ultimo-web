import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Clock } from 'lucide-react';
import { useAlert } from './AlertComponent';

export default function ModalOrari({ isOpen, onClose, centerId }) {
  const [hours, setHours] = useState([]);
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const { error: showAlertError } = useAlert();

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
    for (const h of hours) {
      if (h.is_closed) continue;
      if (!h.open_time || !h.close_time) {
        showAlertError(`Imposta sia l'apertura che la chiusura per ${days[h.day_of_week]}, oppure segnalo come chiuso.`);
        return;
      }
      // "00:00" come chiusura significa mezzanotte (fine giornata), coerente
      // con validateBookingTime in BusinessUtils.jsx.
      const close = h.close_time === '00:00' ? '24:00' : h.close_time;
      if (close <= h.open_time) {
        showAlertError(`${days[h.day_of_week]}: l'orario di chiusura deve essere dopo quello di apertura.`);
        return;
      }
    }

    const { error } = await supabase.from('business_hours').upsert(
      hours.map(h => ({ ...h, center_id: centerId }))
    );
    if (error) {
      showAlertError("Errore nel salvataggio degli orari: " + error.message);
      return;
    }
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm /60 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-slate-50 ">
          <div>
            <h2 className="text-xl font-bold text-slate-800 ">Orari Apertura</h2>
            <p className="text-xs text-slate-500 ">Imposta quando i giocatori possono prenotare</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X /></button>
        </div>

        {/* Lista Giorni */}
        <div className="p-6 overflow-y-auto space-y-4">
          {hours.map((item, index) => (
            <div key={index} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700">{days[item.day_of_week]}</span>
                <button
                  onClick={() => {
                    const newHours = [...hours];
                    newHours[index].is_closed = !newHours[index].is_closed;
                    setHours(newHours);
                  }}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-colors ${item.is_closed ? 'bg-red-100 text-red-600 ' : 'bg-green-100 text-green-600 '}`}
                >
                  {item.is_closed ? 'Chiuso' : 'Aperto'}
                </button>
              </div>

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
                  className="w-full min-w-0 flex-1 bg-white border rounded-lg p-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="flex-shrink-0 text-slate-400">-</span>
                <input
                  type="time"
                  value={item.close_time}
                  disabled={item.is_closed}
                  onChange={(e) => {
                    const newHours = [...hours];
                    newHours[index].close_time = e.target.value;
                    setHours(newHours);
                  }}
                  className="w-full min-w-0 flex-1 bg-white border rounded-lg p-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-white ">
          <button 
            onClick={handleSave}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Save size={20} /> Salva Orari
          </button>
        </div>
      </div>
    </div>
  );
}