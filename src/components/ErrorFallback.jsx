export default function ErrorFallback() {
  return (
    <div className="p-10 flex flex-col items-center text-center gap-3">
      <p className="font-black uppercase text-slate-700">Qualcosa è andato storto</p>
      <p className="text-sm text-slate-500">Riprova a ricaricare la pagina.</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors"
      >
        Ricarica
      </button>
    </div>
  );
}
