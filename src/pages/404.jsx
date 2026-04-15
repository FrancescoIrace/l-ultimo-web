export default function NotFound() {

    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                <h2 className="text-3xl font-black text-blue-600 mb-6 text-center tracking-tight">
                    404 - Pagina non trovata
                </h2>
                <button
                    onClick={() => navigate('/')}
                    className="mt-4 bg-blue-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                    Torna alla Home
                </button>
            </div>
        </>
    )
}

