/**
 * Supabase Edge Function per recuperare data iscrizione e ultimo accesso di un
 * gruppo di utenti. Questi dati vivono solo in auth.users (created_at,
 * last_sign_in_at), non su profiles, e sono leggibili solo tramite la Auth
 * Admin API con service role - da qui la necessita' di una edge function
 * dedicata invece di una semplice select client-side.
 *
 * Deploy con: supabase functions deploy admin-list-user-auth-info
 */

import { serve } from 'https://deno.land/std@0.132.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_USER_IDS = 50;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Non autenticato' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userIds } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > MAX_USER_IDS) {
      return new Response(JSON.stringify({ error: 'Payload non valido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.all(userIds.map(async (id) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
      if (error || !data?.user) return [id, null];
      return [id, {
        created_at: data.user.created_at,
        last_sign_in_at: data.user.last_sign_in_at,
      }];
    }));

    return new Response(JSON.stringify({ users: Object.fromEntries(results) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Errore admin-list-user-auth-info:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
