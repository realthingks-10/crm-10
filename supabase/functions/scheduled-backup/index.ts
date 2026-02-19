import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BACKUP_TABLES = [
  'leads', 'contacts', 'accounts', 'deals', 'action_items',
  'deal_action_items', 'lead_action_items', 'notifications',
  'notification_preferences', 'page_permissions', 'profiles',
  'user_preferences', 'user_roles',
  'saved_filters', 'column_preferences', 'dashboard_preferences',
  'yearly_revenue_targets',
]

const MODULE_TABLES: Record<string, string[]> = {
  contacts: ['contacts'],
  accounts: ['accounts'],
  deals: ['deals', 'deal_action_items', 'leads', 'lead_action_items'],
  action_items: ['action_items'],
  notifications: ['notifications', 'notification_preferences'],
}

const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  every_2_days: 2,
  weekly: 7,
}

const BATCH_SIZE = 1000
const MAX_BACKUPS = 30

async function fetchAllRows(client: any, table: string): Promise<any[]> {
  const allData: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + BATCH_SIZE - 1)
    if (error || !data || data.length === 0) break
    allData.push(...data)
    if (data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }
  return allData
}

function computeNextRun(frequency: string, timeOfDay: string): string {
  const days = FREQUENCY_DAYS[frequency] || 2
  const [hours, minutes] = timeOfDay.split(':').map(Number)
  const next = new Date()
  next.setDate(next.getDate() + days)
  next.setHours(hours, minutes, 0, 0)
  return next.toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch due schedules
    const { data: schedules, error: schedError } = await adminClient
      .from('backup_schedules')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_run_at', new Date().toISOString())

    if (schedError) {
      console.error('Error fetching schedules:', schedError)
      return new Response(JSON.stringify({ error: schedError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: 'No scheduled backups due', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results: any[] = []

    for (const schedule of schedules) {
      try {
        const backupScope = schedule.backup_scope || 'full'
        const backupModule = schedule.backup_module || null

        // Determine tables
        let tablesToBackup = BACKUP_TABLES
        if (backupScope === 'module' && backupModule && MODULE_TABLES[backupModule]) {
          tablesToBackup = MODULE_TABLES[backupModule]
        }

        // Fetch data
        const backupData: Record<string, any[]> = {}
        const manifest: Record<string, number> = {}
        let totalRecords = 0

        for (const table of tablesToBackup) {
          const data = await fetchAllRows(adminClient, table)
          backupData[table] = data
          manifest[table] = data.length
          totalRecords += data.length
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = backupModule
          ? `scheduled-${backupModule}-${timestamp}.json`
          : `scheduled-full-${timestamp}.json`
        const createdBy = schedule.created_by || '00000000-0000-0000-0000-000000000000'
        const filePath = `${createdBy}/${fileName}`

        const backupJson = JSON.stringify({
          version: '1.0',
          created_at: new Date().toISOString(),
          created_by: createdBy,
          backup_type: 'scheduled',
          module_name: backupModule,
          tables: tablesToBackup,
          manifest,
          data: backupData,
        }, null, 2)

        const sizeBytes = new Blob([backupJson]).size

        // Upload
        const { error: uploadError } = await adminClient.storage
          .from('backups')
          .upload(filePath, backupJson, { contentType: 'application/json', upsert: true })

        const status = uploadError ? 'failed' : 'completed'

        // Insert backup record
        await adminClient.from('backups').insert({
          file_name: fileName,
          file_path: filePath,
          backup_type: 'scheduled',
          module_name: backupModule,
          status,
          created_by: createdBy,
          size_bytes: sizeBytes,
          tables_count: tablesToBackup.length,
          records_count: totalRecords,
          manifest,
        })

        // Update schedule
        const nextRunAt = computeNextRun(schedule.frequency, schedule.time_of_day)
        await adminClient.from('backup_schedules').update({
          last_run_at: new Date().toISOString(),
          next_run_at: nextRunAt,
        }).eq('id', schedule.id)

        results.push({ scheduleId: schedule.id, status, records: totalRecords })
        console.log(`Scheduled backup completed: ${fileName} (${totalRecords} records)`)

        // Enforce max backups
        const { data: allBackups } = await adminClient
          .from('backups')
          .select('id, file_path')
          .eq('status', 'completed')
          .order('created_at', { ascending: true })

        if (allBackups && allBackups.length > MAX_BACKUPS) {
          const toDelete = allBackups.slice(0, allBackups.length - MAX_BACKUPS)
          for (const old of toDelete) {
            await adminClient.storage.from('backups').remove([old.file_path])
            await adminClient.from('backups').delete().eq('id', old.id)
          }
        }
      } catch (err: any) {
        console.error(`Error processing schedule ${schedule.id}:`, err)
        results.push({ scheduleId: schedule.id, status: 'failed', error: err.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Scheduled backup error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
