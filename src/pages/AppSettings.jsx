import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { usePushNotifications } from '../hooks/usePushNotifications';
import UserLocationInput from '../components/UserLocationInput';

export default function AppSettings({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [useGeolocation, setUseGeolocation] = useState(true);
  const [pushLoading, setPushLoading] = useState(false);
  const [manualLocation, setManualLocation] = useState({
    location: '',
    province: '',
    zip_code: '',
    location_lat: null,
    location_lng: null,
  });

  // Hook per gestire push notifications
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
  } = usePushNotifications(session?.user?.id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    const stored = localStorage.getItem('appSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSearchRadius(parsed.searchRadius ?? 10);
        setNotificationsEnabled(parsed.notificationsEnabled ?? true);
        setUseGeolocation(parsed.useGeolocation ?? true);
        setManualLocation(parsed.manualLocation ?? manualLocation);
      } catch (error) {
        console.warn('Errore caricamento impostazioni app:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'appSettings',
      JSON.stringify({ searchRadius, notificationsEnabled, useGeolocation, manualLocation })
    );
  }, [searchRadius, notificationsEnabled, useGeolocation, manualLocation]);

  const handleDeleteProfile = async () => {
    const confirmed = window.confirm(
      'Sei sicuro di voler eliminare il profilo? Questa operazione rimuoverà i tuoi dati dal profilo e ti disconnetterà.'
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      await supabase.from('participants').delete().eq('user_id', session.user.id);
      await supabase.from('profiles').delete().eq('id', session.user.id);
      await supabase.auth.signOut();
      localStorage.removeItem('appSettings');
      alert('Profilo eliminato. A presto!');
      navigate('/');
    } catch (error) {
      alert('Errore durante la cancellazione del profilo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalizzazione non supportata dal browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setManualLocation({
          ...manualLocation,
          location: `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        });
        setUseGeolocation(true);
      },
      (error) => {
        alert('Errore geolocalizzazione: ' + error.message);
      }
    );
  };

  /**
   * Attiva le notifiche push
   */
  const handleEnablePushNotifications = async () => {
    setPushLoading(true);
    try {
      const result = await subscribeToPushNotifications();
      if (result.success) {
        alert('✅ Notifiche push attivate!');
      } else {
        alert('❌ Errore: ' + result.error);
      }
    } catch (error) {
      alert('❌ Errore: ' + error.message);
    } finally {
      setPushLoading(false);
    }
  };

  /**
   * Disattiva le notifiche push
   */
  const handleDisablePushNotifications = async () => {
    setPushLoading(true);
    try {
      await unsubscribeFromPushNotifications();
      alert('✅ Notifiche push disattivate');
    } catch (error) {
      alert('❌ Errore: ' + error.message);
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white min-h-screen">
      <button
        onClick={() => navigate(-1)}
        type="button"
        className="w-30 h-5 text-xs cursor-pointer flex items-center justify-center bg-red-600 text-white py-4 mb-4 rounded-2xl font-bold shadow-md shadow-red-200 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
      >
        TORNA INDIETRO
      </button>

      <h1 className="text-3xl font-black text-slate-900 mb-6">Impostazioni app</h1>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-xl font-bold mb-3">Ricerca partite</h2>
        <label className="block text-sm text-slate-600 mb-2">Raggio di ricerca (km)</label>
        <input
          type="range"
          min="1"
          max="50"
          value={searchRadius}
          onChange={(e) => setSearchRadius(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-3 text-slate-700 font-bold">{searchRadius} km</div>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-xl font-bold mb-3">Localizzazione</h2>
        <div className="flex flex-col gap-3 mb-4">
          <button
            type="button"
            onClick={() => setUseGeolocation(true)}
            className={`w-full rounded-2xl border p-3 text-left ${useGeolocation ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            Usa la posizione del dispositivo
          </button>
          <button
            type="button"
            onClick={() => setUseGeolocation(false)}
            className={`w-full rounded-2xl border p-3 text-left ${!useGeolocation ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700'}`}
          >
            Imposta manualmente la posizione
          </button>
        </div>

        {useGeolocation ? (
          <button
            type="button"
            onClick={handleUseDeviceLocation}
            className="w-full rounded-2xl bg-blue-600 text-white py-3 font-bold hover:bg-blue-700 transition-all"
          >
            Aggiorna posizione da GPS
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Scegli una località manuale da utilizzare come base di ricerca.</p>
            <UserLocationInput value={manualLocation} onChange={setManualLocation} />
          </div>
        )}
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-xl font-bold mb-3">Notifiche</h2>
        
        {/* Notifiche generiche */}
        <div className="mb-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-slate-700">Notifiche partite vicine</span>
          </label>
          <p className="text-sm text-slate-500 mt-1">Gestite dal database in real-time</p>
        </div>

        {/* Notifiche Push */}
        {isPushSupported ? (
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold text-slate-700 mb-3">Notifiche push (anche app chiusa)</h3>
            <div className="flex flex-col gap-2">
              {isPushSubscribed ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="text-sm text-slate-600">✅ Attive su questo dispositivo</span>
                  </div>
                  <button
                    disabled={pushLoading}
                    onClick={handleDisablePushNotifications}
                    className="w-full rounded-2xl bg-red-600 text-white py-2 text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {pushLoading ? '⏳ Elaborazione...' : '❌ Disattiva'}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                    <span className="text-sm text-slate-600">⭕ Non attive</span>
                  </div>
                  <button
                    disabled={pushLoading}
                    onClick={handleEnablePushNotifications}
                    className="w-full rounded-2xl bg-green-600 text-white py-2 text-sm font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                  >
                    {pushLoading ? '⏳ Elaborazione...' : '✅ Attiva'}
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">Riceverai notifiche anche quando l'app è chiusa</p>
          </div>
        ) : (
          <div className="border-t pt-4 mt-4 text-sm text-slate-600">
            <span className="text-yellow-700">⚠️</span> Notifiche push non supportate su questo browser
          </div>
        )}
      </section>

          <section className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-xl font-bold mb-3">Privacy</h2>
        <p className="text-sm text-slate-500 mt-2">
          Visualizza l'informativa sulla privacy{' '}
          <Link to="/privacy-policy?from=settings" className="text-blue-600 underline">
            qui
          </Link>.
        </p>
      </section>

      <section className="rounded-3xl border border-red-200 bg-red-50 p-5">
        <h2 className="text-xl font-bold text-red-700 mb-3">Elimina profilo</h2>
        <p className="text-slate-700 mb-4">Questa azione rimuoverà il tuo profilo e le tue partecipazioni. Verrai disconnesso.</p>
        <button
          disabled={loading}
          onClick={handleDeleteProfile}
          className="w-full rounded-2xl bg-red-600 text-white py-3 font-bold hover:bg-red-700 transition-all disabled:opacity-50"
        >
          {loading ? 'Eliminazione in corso...' : 'Elimina il profilo'}
        </button>
      </section>
    </div>
  );
}
