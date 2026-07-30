-- Rinfresco del quiz con domande di attualita' sportiva 2026 (tema
-- "attualita_2026", id 351-365). Fatti verificati via fonti online a luglio
-- 2026: Mondiale 2026 (vinto dalla Spagna), Champions League 2025-26 (PSG),
-- Scudetto 2025-26 (Inter), Olimpiadi invernali Milano-Cortina 2026.
-- correct_index e' 0-based. Si aggiungono al pool attivo, non sostituiscono.
insert into public.quiz_questions (id, question, options, correct_index, theme) values
  (351, 'Quale nazionale ha vinto il Mondiale di calcio 2026?', '["Argentina","Spagna","Francia","Inghilterra"]'::jsonb, 1, 'attualita_2026'),
  (352, 'In finale al Mondiale 2026 la Spagna ha battuto:', '["Brasile","Francia","Argentina","Germania"]'::jsonb, 2, 'attualita_2026'),
  (353, 'Chi ha segnato il gol decisivo, ai supplementari, nella finale del Mondiale 2026?', '["Lamine Yamal","Ferran Torres","Álvaro Morata","Nico Williams"]'::jsonb, 1, 'attualita_2026'),
  (354, 'In quali paesi si è disputato il Mondiale di calcio 2026?', '["Stati Uniti, Canada e Messico","Qatar","Brasile","Messico e Stati Uniti"]'::jsonb, 0, 'attualita_2026'),
  (355, 'Con il trionfo del 2026, quanti titoli mondiali ha vinto in totale la Spagna?', '["1","2","3","4"]'::jsonb, 1, 'attualita_2026'),
  (356, 'Quale portiere argentino fu sommerso di parate nella finale persa del Mondiale 2026?', '["Emiliano Martínez","Gerónimo Rulli","Franco Armani","Walter Benítez"]'::jsonb, 0, 'attualita_2026'),
  (357, 'Chi ha vinto la Champions League 2025-26?', '["Real Madrid","Arsenal","Paris Saint-Germain","Manchester City"]'::jsonb, 2, 'attualita_2026'),
  (358, 'In finale di Champions League 2025-26 il Paris Saint-Germain ha battuto ai rigori:', '["Arsenal","Barcellona","Inter","Bayern Monaco"]'::jsonb, 0, 'attualita_2026'),
  (359, 'In quale città si è giocata la finale di Champions League 2025-26?', '["Monaco di Baviera","Londra","Budapest","Istanbul"]'::jsonb, 2, 'attualita_2026'),
  (360, 'Quale squadra ha vinto lo Scudetto della Serie A 2025-26?', '["Napoli","Inter","Juventus","Milan"]'::jsonb, 1, 'attualita_2026'),
  (361, 'Chi si è classificata seconda in Serie A nella stagione 2025-26?', '["Milan","Juventus","Napoli","Atalanta"]'::jsonb, 2, 'attualita_2026'),
  (362, 'Chi è stato il miglior marcatore dell''Inter campione d''Italia 2025-26?', '["Marcus Thuram","Lautaro Martínez","Mehdi Taremi","Hakan Çalhanoğlu"]'::jsonb, 1, 'attualita_2026'),
  (363, 'In quali due città italiane si sono svolte le Olimpiadi invernali del 2026?', '["Torino e Milano","Milano e Cortina d''Ampezzo","Roma e Cortina d''Ampezzo","Bolzano e Trento"]'::jsonb, 1, 'attualita_2026'),
  (364, 'Quale nazione ha chiuso in testa al medagliere delle Olimpiadi invernali di Milano-Cortina 2026?', '["Germania","Stati Uniti","Norvegia","Italia"]'::jsonb, 2, 'attualita_2026'),
  (365, 'In quale mese si sono tenute le Olimpiadi invernali di Milano-Cortina 2026?', '["Dicembre 2025","Gennaio 2026","Febbraio 2026","Marzo 2026"]'::jsonb, 2, 'attualita_2026');
