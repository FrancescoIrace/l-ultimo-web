import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, MapPin, Search, Loader, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MatchSkeleton from '../components/MatchSkeleton';

export default function CentersList() {
  const navigate = useNavigate();
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchCenters() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, business_address, location')
          .eq('role', 'center')
          .eq('is_visible', true);

        if (error) throw error;
        setCenters(data || []);
      } catch (err) {
        console.error('Error fetching centers:', err);
        setCenters([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCenters();
  }, []);

  const filteredCenters = centers.filter(center => {
    const term = searchTerm.toLowerCase();
    const name = (center.full_name || center.username || '').toLowerCase();
    const address = (center.business_address || center.location || '').toLowerCase();
    return name.includes(term) || address.includes(term);
  });

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Parte fissa: non scrolla mai, solo la lista sotto lo fa */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate(-1)}
            type="button"
            className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
          >
            <ChevronRight size={14} className="rotate-180" />
            Indietro
          </button>
        </div>
        <div className="bg-slate-50 shadow-sm border-b border-slate-200">

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-center gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Centri Associati</h1>
              <p className="text-md text-slate-500 font-medium">Trova la struttura perfetta</p>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 bg-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Cerca per nome o indirizzo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista: unica parte che scrolla */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-4">
        <div className="space-y-3">
          {loading ? (
            <>
              <MatchSkeleton />
              <MatchSkeleton />
            </>
          ) : filteredCenters.length > 0 ? (
            filteredCenters.map((center) => (
              <div
                key={center.id}
                onClick={() => navigate(`/profile/${center.id}`)}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center"
              >
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                  {center.avatar_url ? (
                    <img src={center.avatar_url} alt={center.username} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="text-slate-400" size={28} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-slate-800 text-base truncate">
                      {center.full_name || center.username}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 mt-1 pb-1">
                    <MapPin size={12} className="flex-shrink-0" />
                    <p className="text-xs truncate">
                      {center.business_address || center.location || 'Indirizzo non specificato'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-300 flex-shrink-0" />
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
              <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
              <h3 className="font-bold text-slate-700">Nessun centro trovato</h3>
              <p className="text-sm text-slate-500 mt-1">Prova a cambiare i parametri di ricerca</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}