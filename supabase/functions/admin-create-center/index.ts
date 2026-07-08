/**
 * Supabase Edge Function per creare un account "centro" completo di
 * credenziali reali, dal pannello admin. Riservata agli admin
 * (profiles.is_admin = true). Usa la Auth Admin API per creare l'utente,
 * poi completa il profilo gia' creato dal trigger handle_new_user().
 *
 * Deploy con: supabase functions deploy admin-create-center
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

    const { email, password, username, full_name, business_address, lat, lng, cellulare } = await req.json();

    if (!email || !password || !username || !full_name) {
      return new Response(JSON.stringify({ error: 'Payload non valido: email, password, username e nome del centro sono obbligatori' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });

    if (createError) throw createError;

    const newUserId = created.user.id;

    // Il trigger handle_new_user() ha gia' inserito una riga profiles
    // di base: qui la completiamo con i dati del centro.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'center',
        full_name,
        business_address: business_address || null,
        lat: lat ?? null,
        lng: lng ?? null,
        cellulare: cellulare || null,
        is_visible: true,
      })
      .eq('id', newUserId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, centerId: newUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Errore admin-create-center:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
