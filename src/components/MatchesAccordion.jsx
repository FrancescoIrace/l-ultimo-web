import { useState } from "react";

function AccordionItem({ title, matches, isOpen, titleColor }) {
    const [open, setOpen] = useState(isOpen);
    return (
        <div className="border-b border-slate-200">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center py-4 text-left font-bold text-sm uppercase tracking-wide"
            >
                <h3 className={`text-lg font-black uppercase mb-4 tracking-tighter ${titleColor || 'text-yellow-400'}`}>{title}</h3>

                <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {/* Grid trick: anima da grid-rows-[0fr] a grid-rows-[1fr] */}
            <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="pb-4 text-sm text-slate-500 space-y-3">
                        {matches && matches.length > 0 ? (
                            matches.map((item) => (
                                <div
                                    key={item.matches.id}
                                    onClick={() => navigate(`/match/${item.matches.id}`)}
                                    className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black uppercase text-sm">{item.matches.title || item.matches.sport}</p>
                                            <p className="text-xs text-slate-500">{new Date(item.matches.datetime).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">
                                            {item.matches.sport}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>Nessuna partita disponibile.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AccordionCreatedMatches({ title, matches, isOpen }) {
    const [open, setOpen] = useState(isOpen);
    return (
        <div className="border-b border-slate-200">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center py-4 text-left font-bold text-sm uppercase tracking-wide"
            >
                <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-yellow-400">{title}</h3>

                <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {/* Grid trick: anima da grid-rows-[0fr] a grid-rows-[1fr] */}
            <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="pb-4 text-sm text-slate-500 space-y-3">
                        {matches && matches.length > 0 ? (
                            matches.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => navigate(`/match/${item.id}`)}
                                    className="p-4 border border-slate-100 rounded-2xl bg-white shadow-sm hover:border-blue-200 transition-all cursor-pointer"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black uppercase text-sm">{item.title || item.sport}</p>
                                            <p className="text-xs text-slate-500">{new Date(item.datetime).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold uppercase">
                                            {item.sport}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>Nessuna partita creata.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DefaultAccordion() {
    return (
        <div className="mb-8">
            <AccordionItem title="What is Material Tailwind?">
                We're not always in the position that we want to be at...
            </AccordionItem>
            <AccordionItem title="How to use Material Tailwind?">
                We're not always in the position that we want to be at...
            </AccordionItem>
            <AccordionItem title="What can I do with Material Tailwind?">
                We're not always in the position that we want to be at...
            </AccordionItem>
        </div>
    );
}

export { DefaultAccordion, AccordionItem, AccordionCreatedMatches };