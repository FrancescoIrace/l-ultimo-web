import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, MapPin, Search, Loader, ChevronRight, Trees, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MatchSkeleton from '../components/MatchSkeleton';
import { GetSportStyle } from './business/BusinessUtils';
import ReportPublicCourtModal from '../components/ReportPublicCourtModal';

function openInMaps(court) {
  const query = (court.lat != null && court.lng != null)
    ? `${court.lat},${court.lng}`
    : encodeURIComponent(court.address || court.name);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
}

export default function CentersList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('centers'); // 'centers' | 'publicCourts'
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publicCourts, setPublicCourts] = useState([]);
  const [publicCourtsLoading, setPublicCourtsLoading] = useState(false);
  const [publicCourtsLoaded, setPublicCourtsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);

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

  useEffect(() => {
    if (activeTab !== 'publicCourts' || publicCourtsLoaded) return;

    async function fetchPublicCourts() {
      setPublicCourtsLoading(true);
      const { data, error } = await supabase
        .from('public_courts')
        .select('id, name, sport_type, address, lat, lng, description')
        .eq('is_active', true)
        .eq('status', 'approved');

      if (!error) setPublicCourts(data || []);
      setPublicCourtsLoading(false);
      setPublicCourtsLoaded(true);
    }
    fetchPublicCourts();
  }, [activeTab, publicCourtsLoaded]);

  const filteredCenters = centers.filter(center => {
    const term = searchTerm.toLowerCase();
    const name = (center.full_name || center.username || '').toLowerCase();
    const address = (center.business_address || center.location || '').toLowerCase();
    return name.includes(term) || address.includes(term);
  });

  const filteredPublicCourts = publicCourts.filter(court => {
    const term = searchTerm.toLowerCase();
    const name = (court.name || '').toLowerCase();
    const address = (court.address || '').toLowerCase();
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
          <div className="px-4 pt-6 pb-4 flex items-center justify-center gap-3">
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                {activeTab === 'centers' ? 'Centri Associati' : 'Campi Pubblici'}
              </h1>
              <p className="text-md text-slate-500 font-medium">
                {activeTab === 'centers' ? 'Trova la struttura perfetta' : 'Campetti gratuiti nei parchi vicino a te'}
              </p>
            </div>
          </div>

          {/* Tab */}
          <div className="flex gap-2 px-4 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('centers')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'centers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Centri
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('publicCourts')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'publicCourts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Campi pubblici
            </button>
          </div>

          {/* Search */}
          <div className="p-4 bg-slate-50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder={activeTab === 'centers' ? 'Cerca per nome o indirizzo...' : 'Cerca un campo o un parco...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
            {activeTab === 'publicCourts' && (
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-100 rounded-xl py-2.5 hover:bg-green-100 transition-colors"
              >
                <Megaphone size={16} />
                Non trovi il tuo campo? Segnalalo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista: unica parte che scrolla */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 space-y-4">
        {activeTab === 'centers' ? (
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
        ) : (
          <div className="space-y-3">
            {publicCourtsLoading ? (
              <>
                <MatchSkeleton />
                <MatchSkeleton />
              </>
            ) : filteredPublicCourts.length > 0 ? (
              filteredPublicCourts.map((court) => {
                const style = GetSportStyle(court.sport_type);
                return (
                  <div
                    key={court.id}
                    onClick={() => openInMaps(court)}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex gap-4 items-center"
                  >
                    <div className={`w-16 h-16 rounded-xl ${style.bg} flex items-center justify-center overflow-hidden flex-shrink-0 relative`}>
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: style.pattern, backgroundSize: '10px 10px' }} />
                      <span className="relative z-10 text-white text-[9px] font-black uppercase text-center leading-tight px-1">
                        {court.sport_type}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base truncate">{court.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 mt-1">
                        <MapPin size={12} className="flex-shrink-0" />
                        <p className="text-xs truncate">{court.address || 'Indirizzo non specificato'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-green-100 text-green-700">
                          Gratuito
                        </span>
                      </div>
                      {court.description && (
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{court.description}</p>
                      )}
                    </div>
                    <ChevronRight size={20} className="text-slate-300 flex-shrink-0" />
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 border-dashed">
                <Trees size={40} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-700">Nessun campo pubblico trovato</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {searchTerm ? 'Prova a cambiare i parametri di ricerca' : 'Conosci un campetto che manca? Segnalacelo qui sopra'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ReportPublicCourtModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />
    </div>
  );
}