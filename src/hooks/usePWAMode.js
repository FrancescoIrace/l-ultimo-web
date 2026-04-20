import { useState, useEffect } from 'react';

export const usePWAMode = () => {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // TEST: Temporaneamente ritorna true per testare la PWA dashboard
    const isTest = localStorage.getItem('testPWAMode') === 'true';
    
    if (isTest) {
      setIsPWA(true);
      return;
    }

    // Check se siamo in PWA mode
    // 1. Standard: display-mode standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // 2. iOS legacy
    const isIosPWA = window.navigator.standalone === true;
    
    // 3. Se viene avviato come fullscreen
    const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
    
    setIsPWA(isStandalone || isIosPWA || isFullscreen);
  }, []);

  return isPWA;
};

