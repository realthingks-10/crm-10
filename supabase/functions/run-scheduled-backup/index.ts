import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackupSchedule {
  id: string;
  frequency: string;
  time_of_day: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string | null;
}

function calculateNextRunTime(schedule: BackupSchedule): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
  
  // Create next run date based on frequency
  const nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  // For weekly frequency, find the next matching day
  if (schedule.frequency === 'weekly') {
    const daysUntilNextRun = (7 - now.getDay() + 1) % 7 || 7; // Monday = 1
    nextRun.setDate(now.getDate() + daysUntilNextRun);
    nextRun.setHours(hours, minutes, 0, 0);
  }
  
  return nextRun;
}

function shouldRunNow(schedule: BackupSchedule): boolean {
  if (!schedule.is_enabled) return false;
  
  const now = new Date();
  const [scheduledHours, scheduledMinutes] = schedule.time_of_day.split(':').map(Number);
  
  // Check if we're within the execution window (within 30 minutes of scheduled time)
  const currentHours = now.getUTCHours();
  const currentMinutes = now.getUTCMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  const scheduledTotalMinutes = scheduledHours * 60 + scheduledMinutes;
  
  const diffMinutes = Math.abs(currentTotalMinutes - scheduledTotalMinutes);
  const isWithinWindow = diffMinutes <= 30 || diffMinutes >= (24 * 60 - 30);
  
  if (!isWithinWindow) {
    return false;
  }
  
  // Check if we've already run today
  if (schedule.last_run_at) {
    const lastRun = new Date(schedule.last_run_at);
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    
    // For daily backups, don't run if we ran within the last 20 hours
    if (schedule.frequency === 'daily' && hoursSinceLastRun < 20) {
      return false;
    }
    
    // For weekly backups, don't run if we ran within the last 6 days
    if (schedule.frequency === 'weekly' && hoursSinceLastRun < 144) {
      return false;
    }
  }
  
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for scheduled backups...');

    // Get enabled backup schedules
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('backup_schedules')
      .select('*')
      .eq('is_enabled', true);

    if (schedulesError) {
      console.error('Error fetching schedules:', schedulesError);
      throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      console.log('No enabled backup schedules found');
      return new Response(
        JSON.stringify({ success: true, message: 'No enabled schedules', backupsRun: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let backupsRun = 0;
    const results: any[] = [];

    for (const schedule of schedules) {
      console.log(`Checking schedule: ${schedule.id}, frequency: ${schedule.frequency}, time: ${schedule.time_of_day}`);
      
      if (shouldRunNow(schedule)) {
        console.log(`Running scheduled backup for schedule: ${schedule.id}`);
        
        try {
          // Call the create-backup function
          const backupResponse = await fetch(`${supabaseUrl}/functions/v1/create-backup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({ 
              includeAuditLogs: true,
              backupType: 'scheduled'
            })
          });

          if (!backupResponse.ok) {
            const errorText = await backupResponse.text();
            console.error(`Backup failed for schedule ${schedule.id}:`, errorText);
            results.push({ scheduleId: schedule.id, success: false, error: errorText });
            continue;
          }

          const backupResult = await backupResponse.json();
          console.log(`Backup created successfully for schedule ${schedule.id}`);
          
          // Update schedule with last run time and calculate next run
          const nextRunAt = calculateNextRunTime(schedule);
          
          const { error: updateError } = await supabaseAdmin
            .from('backup_schedules')
            .update({
              last_run_at: new Date().toISOString(),
              next_run_at: nextRunAt.toISOString(),
            })
            .eq('id', schedule.id);

          if (updateError) {
            console.error('Error updating schedule:', updateError);
          }

          backupsRun++;
          results.push({ 
            scheduleId: schedule.id, 
            success: true, 
            backupId: backupResult.backup?.id,
            nextRunAt: nextRunAt.toISOString()
          });
        } catch (backupError: any) {
          console.error(`Error running backup for schedule ${schedule.id}:`, backupError);
          results.push({ scheduleId: schedule.id, success: false, error: backupError.message });
        }
      } else {
        // Just update next_run_at if not running now
        const nextRunAt = calculateNextRunTime(schedule);
        
        // Only update if next_run_at is different or null
        if (!schedule.next_run_at || new Date(schedule.next_run_at).getTime() !== nextRunAt.getTime()) {
          await supabaseAdmin
            .from('backup_schedules')
            .update({ next_run_at: nextRunAt.toISOString() })
            .eq('id', schedule.id);
        }
        
        console.log(`Schedule ${schedule.id} not due yet. Next run: ${nextRunAt.toISOString()}`);
        results.push({ scheduleId: schedule.id, skipped: true, nextRunAt: nextRunAt.toISOString() });
      }
    }

    console.log(`Scheduled backup check complete. Backups run: ${backupsRun}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${schedules.length} schedules, ran ${backupsRun} backups`,
        backupsRun,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Scheduled backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
