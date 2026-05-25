import sys
with open('src/pages/PublicProfile.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "</div>" in line and "</div>" in lines[i-1] and "</div>" in lines[i-2] and "{courts.map" in "".join(lines[i-15:i]):
        print("Found court block at", i)
        pass

with open('src/pages/PublicProfile.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                                              </div>
                                          </div>
                                      </div>"""

replacement = """                                              </div>
                                          </div>
                                          {court.price_p_p && (
                                              <div className="flex flex-col items-end">
                                                  <span className="text-sm font-black text-emerald-600">{Number(court.price_p_p).toFixed(2).replace(/\.00$/, '')}€</span>
                                                  <span className="text-[9px] font-bold uppercase text-slate-400">/persona</span>
                                              </div>
                                          )}
                                      </div>"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced court")

target2 = "                    {/* Campi */}"
orari = """                    {/* Orari */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-5 flex items-center gap-2">
                            <Clock size={16} className="text-blue-500" /> Orari di Apertura
                        </h2>
                        {businessHours && businessHours.length > 0 ? (
                            <div className="space-y-2">
                                {businessHours.sort((a,b) => (a.day_of_week === 0 ? 7 : a.day_of_week) - (b.day_of_week === 0 ? 7 : b.day_of_week)).map(h => (
                                    <div key={h.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                        <span className="font-bold text-slate-600">
                                            {['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][h.day_of_week]}
                                        </span>
                                        {h.is_closed ? (
                                            <span className="text-red-500 font-bold text-xs uppercase bg-red-50 px-2 py-0.5 rounded-md">Chiuso</span>
                                        ) : (
                                            <span className="font-semibold text-slate-700">{h.open_time.slice(0,5)} - {h.close_time.slice(0,5)}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                <p className="text-sm font-bold text-slate-400">Orari non aggiunti</p>
                            </div>
                        )}
                    </div>
"""

if target2 in content:
    content = content.replace(target2, orari + "\n" + target2)
    print("Replaced orari")

with open('src/pages/PublicProfile.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
