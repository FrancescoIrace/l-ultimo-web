import { useState } from "react";
import { useNavigate } from "react-router-dom";

function AccordionItem({ title, matches, isOpen, titleColor }) {
    const [open, setOpen] = useState(isOpen);
    const navigate = useNavigate();

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
    const navigate = useNavigate();

    return (
        <div className="border-b border-slate-200">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center py-4 text-left font-bold text-sm uppercase tracking-wide"
            >
                <h3 className="text-lg font-black uppercase mb-4 tracking-tighter text-orange-400">{title}</h3>

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

function AccorditionReviews({ title, reviews, isOpen }) {
    const [open, setOpen] = useState(isOpen);
    const navigate = useNavigate();

    return (
        <div className="border-b border-slate-200">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex justify-between items-center py-4 text-left font-bold text-sm uppercase tracking-wide"
            >
                <h3 className={`text-lg font-black uppercase mb-4 tracking-tighter text-yellow-400`}>★ {title} ★</h3>

                <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    <div className="pb-4 text-sm text-slate-500 space-y-3">
                        {reviews && reviews.length > 0 ? (
                            reviews.map((rev, index) => (
                                <div key={index} className="border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-black text-yellow-500">{'★'.repeat(rev.rating)}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400">
                                            da
                                            <span onClick={() => navigate(`/profile/${rev.reviewer.id}`)}
                                                className="text-blue-600 cursor-pointer hover:underline ml-1">
                                                {rev.reviewer.username}
                                            </span>
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 italic">"{rev.comment}"</p>
                                    <span className="text-[10px] text-slate-400">{new Date(rev.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))
                        ) : (
                        <p>Nessuna recensione ricevuta.</p>
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

export { DefaultAccordion, AccordionItem, AccordionCreatedMatches, AccorditionReviews };