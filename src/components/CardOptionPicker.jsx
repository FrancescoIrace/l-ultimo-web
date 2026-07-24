import { X, Check, ChevronDown } from 'lucide-react';

/**
 * Modale a card con icona per scegliere un singolo valore da un set fisso
 * (livello di esperienza, sesso, sport preferito), al posto di un <select>
 * nativo - stessa "chrome" (backdrop + pannello centrato) gia' usata da
 * CenterCourtPicker, ma con una griglia di card invece di una lista.
 */
export function CardOptionPicker({ isOpen, onClose, title, subtitle, options, value, onSelect }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full mx-auto relative flex flex-col max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter truncate">{title}</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={20} />
                    </button>
                </div>
                {subtitle && <p className="text-sm text-slate-400 font-semibold mb-4 flex-shrink-0">{subtitle}</p>}

                <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pt-2">
                    <div className="grid grid-cols-2 gap-2.5">
                        {options.map((opt) => {
                            const selected = opt.value === value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onSelect(opt.value); onClose(); }}
                                    className={`relative flex flex-col gap-2 p-3.5 rounded-2xl border-[1.5px] text-left transition-all active:scale-[0.97] ${
                                        selected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                >
                                    <span
                                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: opt.bg, color: opt.fg }}
                                    >
                                        {opt.icon}
                                    </span>
                                    <span className="text-sm font-black text-slate-800 leading-tight">{opt.label}</span>
                                    {opt.description && (
                                        <span className="text-[11px] font-semibold text-slate-400 leading-tight">{opt.description}</span>
                                    )}
                                    {selected && (
                                        <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                            <Check size={12} strokeWidth={3} />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Pulsante che sostituisce visivamente il vecchio <select>, aprendo il CardOptionPicker. */
export function PickerTrigger({ option, placeholder, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-600 font-bold flex items-center gap-3 text-left"
        >
            {option && (
                <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: option.bg, color: option.fg }}
                >
                    {option.icon}
                </span>
            )}
            <span className="flex-1 truncate">{option ? option.label : placeholder}</span>
            <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />
        </button>
    );
}
