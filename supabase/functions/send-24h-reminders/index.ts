/**
 * Edge Function: send-24h-reminders
 *
 * Trova le partite che iniziano tra 23 e 25 ore da adesso e
 * invia una notifica a tutti i partecipanti confermati.
 *
 * Da eseguire ogni ora via cron (vedi migration SQL).
 * Deploy: supabase functions deploy send-24h-reminders
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mappa minimale WMO Weather Codes → emoji + descrizione (allineata a weatherService.js)
const WMO: Record<number, { emoji: string; description: string }> = {
  0: { emoji: '☀️', description: 'sereno' },
  1: { emoji: '🌤️', description: 'poco nuvoloso' },
  2: { emoji: '⛅', description: 'parzialmente nuvoloso' },
  3: { emoji: '☁️', description: 'nuvoloso' },
  45: { emoji: '🌫️', description: 'nebbia' },
  48: { emoji: '🌫️', description: 'nebbia' },
  51: { emoji: '🌧️', description: 'pioggia leggera' },
  53: { emoji: '🌧️', description: 'pioggia moderata' },
  55: { emoji: '🌧️', description: 'pioggia densa' },
  61: { emoji: '🌧️', description: 'pioggia moderata' },
  63: { emoji: '🌧️', description: 'pioggia forte' },
  65: { emoji: '⛈️', description: 'pioggia molto forte' },
  71: { emoji: '❄️', description: 'neve leggera' },
  73: { emoji: '❄️', description: 'neve moderata' },
  75: { emoji: '❄️', description: 'neve densa' },
  80: { emoji: '⛈️', description: 'rovesci' },
  81: { emoji: '⛈️', description: 'rovesci moderati' },
  82: { emoji: '⛈️', description: 'rovesci forti' },
  85: { emoji: '❄️', description: 'rovesci di neve' },
  86: { emoji: '❄️', description: 'rovesci di neve forti' },
  95: { emoji: '⛈️', description: 'temporale' },
  96: { emoji: '⛈️', description: 'temporale con grandine' },
  99: { emoji: '⛈️', description: 'temporale con grandine' },
};

interface MatchWeather {
  code: number;
  temperature: number;
  rainProbability: number;
  emoji: string;
  description: string;
}

/**
 * Recupera il meteo previsto all'ora della partita via Open-Meteo (nessuna API key).
 * Confronta gli orari come stringhe wall-clock (timezone Europe/Rome) per evitare
 * problemi di fuso orario nel runtime Deno.
 */
async function getMatchWeather(
  lat: number | null,
  lng: number | null,
  datetimeStr: string | null,
): Promise<MatchWeather | null> {
  if (lat == null || lng == null || !datetimeStr) return null;
  try {
    const iso = String(datetimeStr).replace(' ', 'T');
    const dayStr = iso.slice(0, 10);       // YYYY-MM-DD
    const hourPrefix = iso.slice(0, 13);   // YYYY-MM-DDTHH

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', String(lat));
    url.searchParams.append('longitude', String(lng));
    url.searchParams.append('start_date', dayStr);
    url.searchParams.append('end_date', dayStr);
    url.searchParams.append('hourly', 'weather_code,temperature_2m,precipitation_probability');
    url.searchParams.append('timezone', 'Europe/Rome');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();
    const times: string[] | undefined = data?.hourly?.time;
    if (!times) return null;

    let idx = times.findIndex((t) => t.startsWith(hourPrefix));
    if (idx === -1) idx = 0; // fallback: primo slot disponibile del giorno

    const code = data.hourly.weather_code[idx];
    return {
      code,
      temperature: Math.round(data.hourly.temperature_2m[idx]),
      rainProbability: data.hourly.precipitation_probability[idx] ?? 0,
      emoji: WMO[code]?.emoji ?? '🌦️',
      description: WMO[code]?.description ?? 'condizioni incerte',
    };
  } catch (_e) {
    return null;
  }
}

// Brutto tempo: alta probabilità di pioggia o codice di precipitazione (>= 51)
function isBadWeather(w: MatchWeather): boolean {
  return w.rainProbability >= 60 || w.code >= 51;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // +23h
    const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // +25h

    // 1. Trova partite nel range 23-25h che non hanno ancora ricevuto il reminder
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('id, title, datetime, location_lat, location_lng')
      .gte('datetime', windowStart.toISOString())
      .lte('datetime', windowEnd.toISOString())
      .eq('reminder_24h_sent', false);

    if (matchError) throw matchError;

    console.log(`📅 Partite da notificare: ${matches?.length ?? 0}`);

    let notificationsSent = 0;

    for (const match of matches ?? []) {
      // 2. Prendi i partecipanti confermati
      const { data: participants, error: partError } = await supabase
        .from('participants')
        .select('user_id')
        .eq('match_id', match.id)
        .eq('status', 'confirmed');

      if (partError) {
        console.error(`❌ Errore partecipanti per match ${match.id}:`, partError);
        continue;
      }

      if (!participants || participants.length === 0) {
        // Nessun partecipante, segna comunque il reminder come inviato
        await supabase.from('matches').update({ reminder_24h_sent: true }).eq('id', match.id);
        continue;
      }

      // 2b. Controlla il meteo una volta per partita (se ha coordinate)
      const weather = await getMatchWeather(match.location_lat, match.location_lng, match.datetime);
      const badWeather = weather ? isBadWeather(weather) : false;

      // Il reminder è "meteo-aware": se il tempo è brutto cambia tipo/titolo/contenuto,
      // così resta UNA sola notifica per partecipante (niente doppioni)
      const notifType    = badWeather ? 'weather_alert' : 'match_reminder';
      const notifTitle   = badWeather
        ? `${weather!.emoji} Meteo in peggioramento!`
        : '⏰ Domani si gioca!';
      const notifContent = badWeather
        ? `Per "${match.title}" (tra ~24h) sono previsti ${weather!.description} con ${weather!.rainProbability}% di pioggia. Valuta se coprirti o riprogrammare.`
        : `La partita "${match.title}" inizia tra circa 24 ore. Sei pronto?`;
      const notifMetadata = badWeather
        ? { matchId: match.id, weather }
        : { matchId: match.id };

      // 3. Crea una notifica per ogni partecipante tramite RPC
      const notificationIds: string[] = [];

      for (const p of participants) {
        const { data: notifId, error: notifError } = await supabase.rpc(
          'create_notification_with_push',
          {
            p_user_id:   p.user_id,
            p_sender_id: null,
            p_type:      notifType,
            p_title:     notifTitle,
            p_content:   notifContent,
            p_link:      `/match/${match.id}`,
            p_metadata:  notifMetadata,
            p_send_push: true,
          }
        );

        if (notifError) {
          console.error(`❌ Errore creazione notifica per ${p.user_id}:`, notifError);
          continue;
        }

        if (notifId) {
          notificationIds.push(notifId);
          notificationsSent++;
        }
      }

      // 4. Invia push per ogni notifica creata
      for (const notifId of notificationIds) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: { notificationId: notifId },
          });
        } catch (pushErr) {
          console.error(`❌ Errore push per notifica ${notifId}:`, pushErr);
        }
      }

      // 5. Segna il match come "reminder 24h inviato"
      const { error: updateError } = await supabase
        .from('matches')
        .update({ reminder_24h_sent: true })
        .eq('id', match.id);

      if (updateError) {
        console.error(`❌ Errore aggiornamento reminder_24h_sent per match ${match.id}:`, updateError);
      }

      console.log(`✅ Match ${match.id}: ${notificationIds.length} notifiche inviate`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        matchesProcessed: matches?.length ?? 0,
        notificationsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('❌ Errore generale in send-24h-reminders:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
