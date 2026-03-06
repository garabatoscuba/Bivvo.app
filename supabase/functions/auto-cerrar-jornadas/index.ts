import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Close jornadas open for more than 13 hours
    const { data: staleJornadas, error: staleErr } = await supabase
      .from('jornadas')
      .select('id, apertura_at, empleado_id')
      .is('cierre_at', null)
      .lt('apertura_at', new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString())

    if (staleErr) throw staleErr

    let closedCount = 0

    for (const j of staleJornadas || []) {
      const aperturaMs = new Date(j.apertura_at).getTime()
      const nowMs = Date.now()
      const duracionMin = Math.floor((nowMs - aperturaMs) / 60000)

      const { error } = await supabase
        .from('jornadas')
        .update({
          cierre_at: new Date().toISOString(),
          metodo_cierre: 'automatico_medianoche',
          incidencia: true,
          notas: 'Cierre automático: jornada mayor a 13 horas',
          duracion_min: duracionMin,
        })
        .eq('id', j.id)

      if (!error) {
        closedCount++
        // Auto-close orphaned cash register for this employee
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', j.empleado_id)
          .maybeSingle()
        if (profileData?.user_id) {
          await supabase
            .from('cash_registers')
            .update({ status: 'closed', closed_at: new Date().toISOString(), notes: 'Cierre automático: jornada mayor a 13 horas' })
            .eq('user_id', profileData.user_id)
            .eq('status', 'open')
        }
      }
    }

    // 2. Close jornadas from previous days
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: oldJornadas, error: oldErr } = await supabase
      .from('jornadas')
      .select('id, apertura_at, empleado_id')
      .is('cierre_at', null)
      .lt('apertura_at', today.toISOString())

    if (oldErr) throw oldErr

    for (const j of oldJornadas || []) {
      const aperturaDate = new Date(j.apertura_at)
      const cierreAt = new Date(aperturaDate)
      cierreAt.setHours(23, 59, 0, 0)

      const duracionMin = Math.floor((cierreAt.getTime() - aperturaDate.getTime()) / 60000)

      const { error } = await supabase
        .from('jornadas')
        .update({
          cierre_at: cierreAt.toISOString(),
          metodo_cierre: 'automatico_medianoche',
          incidencia: true,
          notas: 'Cierre automático por cambio de día',
          duracion_min: duracionMin,
        })
        .eq('id', j.id)

      if (!error) closedCount++
    }

    return new Response(
      JSON.stringify({ success: true, closed: closedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
