import { useState, createContext, useContext } from 'react';
import { X, AlertCircle } from 'lucide-react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const showAlert = (message, type = 'info', duration = 3000) => {
    setAlert({ message, type, id: Date.now() });
    if (duration) {
      setTimeout(() => setAlert(null), duration);
    }
  };

  const showConfirm = (message, onConfirm, onCancel, isDangerous = false) => {
    return new Promise((resolve) => {
      setAlert({
        message,
        type: 'confirm',
        isDangerous,
        onConfirm: () => {
          onConfirm?.();
          setAlert(null);
          resolve(true);
        },
        onCancel: () => {
          onCancel?.();
          setAlert(null);
          resolve(false);
        },
      });
    });
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {alert && (
        <>
          {alert.type === 'confirm' ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                <div className="flex items-start gap-4 mb-6">
                  <AlertCircle className="text-yellow-500 flex-shrink-0" size={24} />
                  <div>
                    <h3 className="font-black text-lg text-slate-800">Conferma</h3>
                    <p className="text-slate-600 mt-2">{alert.message}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={alert.onCancel}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={alert.onConfirm}
                    className={`flex-1 py-3 font-black rounded-2xl uppercase text-[10px] tracking-widest transition-colors ${
                      alert.isDangerous
                        ? 'bg-red-600 text-white shadow-lg shadow-red-200 hover:bg-red-700'
                        : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'
                    }`}
                  >
                    Conferma
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`fixed bottom-6 right-6 max-w-sm rounded-2xl p-4 shadow-lg flex items-start gap-4 z-50 ${
                alert.type === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : alert.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <p
                className={`font-bold text-sm flex-1 ${
                  alert.type === 'error'
                    ? 'text-red-700'
                    : alert.type === 'success'
                    ? 'text-green-700'
                    : 'text-blue-700'
                }`}
              >
                {alert.message}
              </p>
              <button
                onClick={() => setAlert(null)}
                className="flex-shrink-0 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </AlertContext.Provider>
  );
}

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert deve essere usato dentro AlertProvider');
  return {
    alert: (message) => context.showAlert(message, 'info'),
    success: (message) => context.showAlert(message, 'success'),
    error: (message) => context.showAlert(message, 'error'),
    confirm: (message, onConfirm, onCancel) => context.showConfirm(message, onConfirm, onCancel, false),
    confirmDangerous: (message, onConfirm, onCancel) => context.showConfirm(message, onConfirm, onCancel, true),
  };
};

// Componente di demo (per compatibilità con il vecchio import)
export function AlertDialogDemo() {
//   return null; // Non mostra nulla
}