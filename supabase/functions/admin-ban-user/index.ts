/**
 * Supabase Edge Function per bannare/sbannare un utente.
 * Riservata agli admin (profiles.is_admin = true). Usa la Auth Admin API
 * per impedire davvero il login, non solo un flag cosmetico.
 *
 * Deploy con: supabase functions deploy admin-ban-user
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

    const { targetUserId, action, reason } = await req.json();

    if (!targetUserId || !['ban', 'unban'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Payload non valido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'ban') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: '876000h', // ~100 anni: ban di fatto permanente
      });
      if (error) throw error;

      await supabaseAdmin
        .from('profiles')
        .update({ is_banned: true, ban_reason: reason || null })
        .eq('id', targetUserId);
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        ban_duration: 'none',
      });
      if (error) throw error;

      await supabaseAdmin
        .from('profiles')
        .update({ is_banned: false, ban_reason: null })
        .eq('id', targetUserId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('❌ Errore admin-ban-user:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
