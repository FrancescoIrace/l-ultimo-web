// src/components/MatchSkeleton.jsx
export default function MatchSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm animate-pulse">
      {/* Header: Sport e Titolo */}
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-3 w-full">
          <div className="h-4 bg-slate-200 rounded-full w-20"></div>
          <div className="h-6 bg-slate-200 rounded-full w-3/4"></div>
        </div>
      </div>

      {/* Info: Data e Luogo */}
      <div className="space-y-2 mb-6">
        <div className="h-4 bg-slate-100 rounded-full w-1/2"></div>
        <div className="h-4 bg-slate-100 rounded-full w-1/3"></div>
      </div>

      {/* Footer: Posti e Bottone */}
      <div className="flex justify-between items-center mt-4">
        <div className="space-y-2">
          <div className="h-3 bg-slate-100 rounded-full w-10"></div>
          <div className="h-6 bg-slate-200 rounded-full w-16"></div>
        </div>
        <div className="h-10 bg-slate-200 rounded-2xl w-28"></div>
      </div>
    </div>
  );
}