import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tables in correct deletion order (children first, parents last)
const DELETE_ORDER = [
  'deal_action_items', 'lead_action_items', 'action_items',
  'notifications', 'notification_preferences', 'saved_filters',
  'column_preferences', 'dashboard_preferences', 'user_sessions',
  'deals', 'contacts', 'leads', 'accounts',
  'user_preferences', 'yearly_revenue_targets', 'page_permissions',
  'keep_alive'
]

// Tables in correct insertion order (parents first, children last)
const INSERT_ORDER = [
  'accounts', 'leads', 'contacts', 'deals',
  'lead_action_items', 'deal_action_items', 'action_items',
  'notifications', 'notification_preferences', 'saved_filters',
  'column_preferences', 'dashboard_preferences', 'user_sessions',
  'user_preferences', 'yearly_revenue_targets', 'page_permissions',
  'keep_alive'
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check admin
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { backupId } = await req.json()
    if (!backupId) {
      return new Response(JSON.stringify({ error: 'backupId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get backup metadata
    const { data: backup, error: fetchError } = await adminClient
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (fetchError || !backup) {
      return new Response(JSON.stringify({ error: 'Backup not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Download backup file from storage
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('backups')
      .download(backup.file_path)

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: 'Failed to download backup file' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const backupContent = JSON.parse(await fileData.text())
    const backupData = backupContent.data
    if (!backupData) {
      return new Response(JSON.stringify({ error: 'Invalid backup format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const restoredTables: string[] = []
    let restoredRecords = 0

    // Determine tables to restore
    const tablesToRestore = Object.keys(backupData)

    // Delete existing data in reverse dependency order
    // Skip tables not in the backup (e.g. user_roles, profiles - managed by auth)
    for (const table of DELETE_ORDER) {
      if (tablesToRestore.includes(table)) {
        const { error } = await adminClient.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) {
          console.error(`Error clearing ${table}:`, error)
        }
      }
    }

    // Insert data in correct order
    for (const table of INSERT_ORDER) {
      if (!backupData[table] || backupData[table].length === 0) continue

      // Insert in batches of 500
      const records = backupData[table]
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500)
        const { error } = await adminClient.from(table).upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error(`Error restoring ${table} batch ${i}:`, error)
        }
      }

      restoredTables.push(table)
      restoredRecords += records.length
    }

    // Also restore any tables in the backup that aren't in INSERT_ORDER
    for (const table of tablesToRestore) {
      if (INSERT_ORDER.includes(table) || !backupData[table]?.length) continue
      const records = backupData[table]
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500)
        const { error } = await adminClient.from(table).upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error(`Error restoring ${table}:`, error)
        }
      }
      restoredTables.push(table)
      restoredRecords += records.length
    }

    return new Response(JSON.stringify({
      success: true,
      restoredTables,
      restoredRecords,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Restore error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
