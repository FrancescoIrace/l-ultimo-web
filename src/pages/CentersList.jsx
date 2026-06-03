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

  // Placeholder data
  const placeholders = [
    {
      id: 'placeholder-1',
      username: 'Jumbo Padel & Calcetto',
      full_name: 'Jumbo Padel & Calcetto',
      business_address: 'Via dello Sport 1, Milano',
      avatar_url: 'https://images.unsplash.com/photo-1556054817-64cd1e2c1e84?auto=format&fit=crop&q=80&w=200&h=200',
      role: 'center',
      isPlaceholder: true,
    },
    {
      id: 'placeholder-2',
      username: 'Centrale Sport Club',
      full_name: 'Centrale Sport Club',
      business_address: 'Piazza Garibaldi 24, Roma',
      avatar_url: 'https://images.unsplash.com/photo-1542659086-635b7190d659?auto=format&fit=crop&q=80&w=200&h=200',
      role: 'center',
      isPlaceholder: true,
    },
    {
      id: 'placeholder-3',
      username: 'Arena Soccer Stadium',
      full_name: 'Arena Soccer Stadium',
      business_address: 'Viale Kennedy 12, Napoli',
      avatar_url: 'https://images.unsplash.com/photo-1600255821058-c4f89958d700?auto=format&fit=crop&q=80&w=200&h=200',
      role: 'center',
      isPlaceholder: true,
    }
  ];

  useEffect(() => {
    async function fetchCenters() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, business_address, location')
          .eq('role', 'center');

        if (error) throw error;
        
        // Unisci i dati reali con i placeholder
        const combined = [...(data || []), ...placeholders];
        setCenters(combined);
      } catch (err) {
        console.error('Error fetching centers:', err);
        setCenters(placeholders); // fallback to placeholders on error
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
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-[58px] z-30 shadow-sm flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-slate-600 active:bg-slate-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">Centri Associati</h1>
          <p className="text-xs text-slate-500 font-medium">Trova la struttura perfetta</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
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

        {/* List */}
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
                onClick={() => center.isPlaceholder ? alert('Questo è un centro di esempio!') : navigate(`/profile/${center.id}`)}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center"
              >
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                  {center.avatar_url ? (
                    <img src={center.avatar_url} alt={center.username} className="w-full h-full object-cover" />
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
                  {center.isPlaceholder && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      Esempio
                    </span>
                  )}
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