import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { company_id, job_ids } = await req.json()

    if (!company_id) {
      throw new Error('company_id is required')
    }

    // Get all time cards for the company (optionally filtered by jobs)
    let query = supabaseClient
      .from('time_cards')
      .select('*')
      .eq('company_id', company_id)
      .not('punch_out_time', 'is', null)
      .is('deleted_at', null)

    if (job_ids && job_ids.length > 0) {
      query = query.in('job_id', job_ids)
    }

    const { data: timeCards, error: fetchError } = await query

    if (fetchError) throw fetchError
    
    // Get unique job IDs from time cards
    const uniqueJobIds = [...new Set(timeCards?.map(tc => tc.job_id).filter(Boolean))]
    
    // Fetch job settings for all jobs
    const { data: jobs, error: jobsError } = await supabaseClient
      .from('jobs')
      .select('id, shift_start_time, shift_end_time, count_early_punch_in, early_punch_in_grace_minutes, count_late_punch_out, late_punch_out_grace_minutes')
      .in('id', uniqueJobIds)
    
    if (jobsError) throw jobsError
    
    // Create a map for quick job lookup
    const jobsMap = new Map(jobs?.map(job => [job.id, job]) || [])

    // Fetch punch clock settings (company-level)
    const { data: companySettings } = await supabaseClient
      .from('job_punch_clock_settings')
      .select('calculate_overtime, overtime_threshold, auto_break_duration, auto_break_wait_hours')
      .eq('company_id', company_id)
      .is('job_id', null)
      .maybeSingle()

    // Fetch job-specific settings for all relevant jobs
    const { data: jobSettings } = await supabaseClient
      .from('job_punch_clock_settings')
      .select('job_id, calculate_overtime, overtime_threshold, auto_break_duration, auto_break_wait_hours')
      .eq('company_id', company_id)
      .in('job_id', uniqueJobIds)

    // Create settings map (job-specific overrides company-level)
    const settingsMap = new Map()
    uniqueJobIds.forEach(jobId => {
      const jobSetting = jobSettings?.find(s => s.job_id === jobId)
      settingsMap.set(jobId, jobSetting || companySettings || {})
    })

    let updatedCount = 0
    const errors: any[] = []

    // Process each time card
    for (const card of timeCards || []) {
      try {
        if (!card.job_id) continue
        const job = jobsMap.get(card.job_id)
        if (!job) continue
        const punchInTime = new Date(card.punch_in_time)
        const punchOutTime = new Date(card.punch_out_time)

        let adjustedPunchIn = punchInTime
        let adjustedPunchOut = punchOutTime

        // Apply shift time rules if configured
        if (job?.shift_start_time && job?.shift_end_time) {
          const shiftStart = new Date(punchInTime)
          const [startHours, startMinutes] = job.shift_start_time.split(':').map(Number)
          shiftStart.setHours(startHours, startMinutes, 0, 0)

          const shiftEnd = new Date(punchOutTime)
          const [endHours, endMinutes] = job.shift_end_time.split(':').map(Number)
          shiftEnd.setHours(endHours, endMinutes, 0, 0)

          // Handle overnight shifts
          if (shiftEnd < shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1)
          }

          const earlyGrace = job.early_punch_in_grace_minutes || 15
          const lateGrace = job.late_punch_out_grace_minutes || 15
          const countEarly = job.count_early_punch_in || false
          const countLate = job.count_late_punch_out !== false

          // Early punch-in handling
          if (punchInTime < shiftStart) {
            const graceStart = new Date(shiftStart.getTime() - earlyGrace * 60000)
            
            if (punchInTime >= graceStart) {
              // Within grace period - don't count unless setting allows
              if (!countEarly) {
                adjustedPunchIn = shiftStart
              }
            }
            // Outside grace period - count all early time
          }

          // Late punch-out handling
          if (punchOutTime > shiftEnd) {
            const graceEnd = new Date(shiftEnd.getTime() + lateGrace * 60000)
            
            if (punchOutTime <= graceEnd) {
              // Within grace period - don't count unless setting allows
              if (!countLate) {
                adjustedPunchOut = shiftEnd
              }
            }
            // Outside grace period - count all late time
          }
        }

        // Get settings for this job
        const settings = settingsMap.get(card.job_id) || companySettings || {}
        const calculateOvertime = settings.calculate_overtime === true
        const overtimeThreshold = settings.overtime_threshold || 8
        const autoBreakDuration = settings.auto_break_duration || 30
        const autoBreakWaitHours = settings.auto_break_wait_hours || 6

        // Calculate total hours
        let totalHours = (adjustedPunchOut.getTime() - adjustedPunchIn.getTime()) / (1000 * 60 * 60)

        // Apply auto break deduction if over threshold
        if (totalHours > autoBreakWaitHours) {
          totalHours -= autoBreakDuration / 60
        }

        // Calculate overtime only if enabled in settings
        const overtimeHours = calculateOvertime ? Math.max(0, totalHours - overtimeThreshold) : 0

        // Update the time card
        const { error: updateError } = await supabaseClient
          .from('time_cards')
          .update({
            punch_in_time: adjustedPunchIn.toISOString(),
            punch_out_time: adjustedPunchOut.toISOString(),
            total_hours: totalHours,
            overtime_hours: overtimeHours,
            updated_at: new Date().toISOString()
          })
          .eq('id', card.id)

        if (updateError) {
          errors.push({ timecard_id: card.id, error: updateError.message })
        } else {
          updatedCount++
        }
      } catch (error: any) {
        errors.push({ timecard_id: card.id, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_processed: timeCards?.length || 0,
        updated_count: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
