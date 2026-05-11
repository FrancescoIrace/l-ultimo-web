import { useState, useEffect } from 'react';
import { X, Share, Home, Bell } from 'lucide-react';

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deviceType, setDeviceType] = useState('desktop'); // 'ios', 'android', 'desktop'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Rilevamento dispositivo
    const userAgent = navigator.userAgent;
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      setDeviceType('ios');
    } else if (userAgent.includes('Android')) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Controllo se già in modalità standalone
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Controllo se l'utente ha già chiuso il banner (temporaneamente)
    const bannerClosed = localStorage.getItem('pwaBannerClosed');
    if (bannerClosed) {
      const closedTime = parseInt(bannerClosed);
      const now = Date.now();
      // Nasconde per 24 ore
      if (now - closedTime < 24 * 60 * 60 * 1000) {
        return;
      } else {
        localStorage.removeItem('pwaBannerClosed');
      }
    }

    // Intercetta beforeinstallprompt per Android
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (deviceType === 'android' && !isStandalone) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Mostra banner per iOS se non standalone
    if (deviceType === 'ios' && !isStandalone) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [deviceType, isStandalone]);

  const handleInstallAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleCloseBanner = () => {
    setShowBanner(false);
    localStorage.setItem('pwaBannerClosed', Date.now().toString());
  };

  if (!showBanner || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg border border-slate-700 max-w-md mx-auto">
        <button
          onClick={handleCloseBanner}
          className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {deviceType === 'android' && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Home size={24} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-1">Installa L'Ultimo</h3>
              <p className="text-xs text-slate-300 mb-3">
                Aggiungi alla Home per notifiche push e migliore esperienza
              </p>
              <button
                onClick={handleInstallAndroid}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
              >
                Installa App
              </button>
            </div>
          </div>
        )}

        {deviceType === 'ios' && (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <Bell size={24} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm mb-1">Installa per le Notifiche</h3>
              <p className="text-xs text-slate-300 mb-2">
                Per ricevere reminder delle partite, aggiungi L'Ultimo alla Home:
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <Share size={16} />
                <span>1. Tocca</span>
                <span className="bg-slate-700 px-2 py-1 rounded">Condividi</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Home size={16} />
                <span>2. Scegli</span>
                <span className="bg-slate-700 px-2 py-1 rounded">Aggiungi alla Home</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}