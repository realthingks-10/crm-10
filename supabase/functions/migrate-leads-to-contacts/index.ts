import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun !== false // default true

    console.log(`[migrate] Starting migration. dryRun: ${dryRun}`)

    // Step 1: Fetch all leads
    const { data: leads, error: leadsErr } = await supabase.from('leads').select('*')
    if (leadsErr) throw new Error(`Failed to fetch leads: ${leadsErr.message}`)
    console.log(`[migrate] Found ${leads?.length || 0} leads`)

    // Step 2: Fetch all contacts for duplicate checking
    const allContacts: any[] = []
    let offset = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await supabase.from('contacts').select('id, contact_name, email').range(offset, offset + PAGE - 1)
      if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
      if (!data || data.length === 0) break
      allContacts.push(...data)
      if (data.length < PAGE) break
      offset += PAGE
    }
    console.log(`[migrate] Loaded ${allContacts.length} existing contacts`)

    // Build lookup maps
    const contactByEmail = new Map<string, { id: string; contact_name: string }>()
    const contactByName = new Map<string, { id: string; contact_name: string }>()
    for (const c of allContacts) {
      if (c.email?.trim()) contactByEmail.set(c.email.trim().toLowerCase(), { id: c.id, contact_name: c.contact_name })
      if (c.contact_name?.trim()) contactByName.set(c.contact_name.trim().toLowerCase(), { id: c.id, contact_name: c.contact_name })
    }

    // Step 3: Fetch deals in Lead stage
    const { data: leadDeals, error: dealsErr } = await supabase.from('deals').select('id, deal_name, lead_name, customer_name').eq('stage', 'Lead')
    if (dealsErr) throw new Error(`Failed to fetch deals: ${dealsErr.message}`)
    console.log(`[migrate] Found ${leadDeals?.length || 0} deals in Lead stage`)

    // Step 4: Process each lead
    const report: any[] = []
    const leadNameToContactName = new Map<string, string>() // for deal linking

    for (const lead of (leads || [])) {
      const entry: any = {
        leadId: lead.id,
        leadName: lead.lead_name,
        email: lead.email,
        action: 'unknown',
      }

      // Check for duplicate by email first, then by name
      let existingContact = null
      if (lead.email?.trim()) {
        existingContact = contactByEmail.get(lead.email.trim().toLowerCase()) || null
        if (existingContact) entry.matchedVia = 'email'
      }
      if (!existingContact && lead.lead_name?.trim()) {
        existingContact = contactByName.get(lead.lead_name.trim().toLowerCase()) || null
        if (existingContact) entry.matchedVia = 'name'
      }

      if (existingContact) {
        entry.action = 'skipped_duplicate'
        entry.existingContactId = existingContact.id
        entry.existingContactName = existingContact.contact_name
        leadNameToContactName.set(lead.lead_name?.trim().toLowerCase() || '', existingContact.contact_name)
      } else {
        // Map fields and create new contact
        const newContact = {
          contact_name: lead.lead_name,
          company_name: lead.company_name || null,
          email: lead.email || null,
          phone_no: lead.phone_no || null,
          position: lead.position || null,
          region: lead.country || null, // country -> region
          industry: lead.industry || null,
          contact_source: lead.contact_source || null,
          linkedin: lead.linkedin || null,
          website: lead.website || null,
          description: lead.description || null,
          contact_owner: lead.contact_owner || null,
          created_by: lead.created_by || user.id,
          created_time: lead.created_time || new Date().toISOString(),
        }

        if (!dryRun) {
          const { data: inserted, error: insertErr } = await supabase
            .from('contacts')
            .insert(newContact)
            .select('id, contact_name')
            .single()

          if (insertErr) {
            entry.action = 'error'
            entry.error = insertErr.message
            report.push(entry)
            continue
          }
          entry.newContactId = inserted.id
          // Add to lookup maps so subsequent leads can detect duplicates
          if (newContact.email) contactByEmail.set(newContact.email.toLowerCase(), { id: inserted.id, contact_name: inserted.contact_name })
          contactByName.set(inserted.contact_name.toLowerCase(), { id: inserted.id, contact_name: inserted.contact_name })
        }
        entry.action = 'created'
        leadNameToContactName.set(lead.lead_name?.trim().toLowerCase() || '', lead.lead_name)
      }

      // Update lead status to Converted
      if (!dryRun) {
        await supabase.from('leads').update({ lead_status: 'Converted' }).eq('id', lead.id)
      }
      entry.leadStatusUpdated = true

      report.push(entry)
    }

    // Step 5: Link deals to contacts
    const dealUpdates: any[] = []
    for (const deal of (leadDeals || [])) {
      const dealEntry: any = { dealId: deal.id, dealName: deal.deal_name, action: 'no_match' }

      // Try matching deal's lead_name or customer_name to a lead
      const searchNames = [deal.lead_name, deal.customer_name].filter(Boolean)
      let matchedContactName: string | null = null

      for (const name of searchNames) {
        const key = name!.trim().toLowerCase()
        // Check our migration map first
        if (leadNameToContactName.has(key)) {
          matchedContactName = leadNameToContactName.get(key)!
          dealEntry.matchedVia = 'migration_map'
          break
        }
        // Fallback: check contact lookup
        const existing = contactByName.get(key)
        if (existing) {
          matchedContactName = existing.contact_name
          dealEntry.matchedVia = 'contact_lookup'
          break
        }
      }

      if (matchedContactName) {
        dealEntry.action = 'linked'
        dealEntry.contactName = matchedContactName
        if (!dryRun) {
          await supabase.from('deals').update({ lead_name: matchedContactName }).eq('id', deal.id)
        }
      }

      dealUpdates.push(dealEntry)
    }

    const summary = {
      dryRun,
      totalLeads: leads?.length || 0,
      created: report.filter(r => r.action === 'created').length,
      skippedDuplicates: report.filter(r => r.action === 'skipped_duplicate').length,
      errors: report.filter(r => r.action === 'error').length,
      totalDealsInLeadStage: leadDeals?.length || 0,
      dealsLinked: dealUpdates.filter(d => d.action === 'linked').length,
      dealsUnmatched: dealUpdates.filter(d => d.action === 'no_match').length,
    }

    console.log(`[migrate] Summary:`, JSON.stringify(summary))

    return new Response(JSON.stringify({ success: true, summary, leadMigration: report, dealLinking: dealUpdates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error')
    console.error('[migrate] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
