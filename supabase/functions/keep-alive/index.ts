import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Keep-alive ping received at:", new Date().toISOString());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update the keep-alive record to generate database activity
    const { data, error } = await supabase
      .from('keep_alive')
      .upsert({ 
        id: 1,
        "Able to read DB": new Date().toISOString()
      })
      .select();

    if (error) {
      console.error("Keep-alive upsert error:", error);
      
      // Fallback: just do a simple count query to keep DB active
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      console.log("Fallback query executed, profiles count:", count);
      
      return new Response(JSON.stringify({ 
        status: 'alive', 
        fallback: true,
        profiles_count: count,
        timestamp: new Date().toISOString() 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Keep-alive successful:", data);

    return new Response(JSON.stringify({ 
      status: 'alive', 
      timestamp: new Date().toISOString(),
      data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("Keep-alive error:", errorMessage);
    return new Response(JSON.stringify({ 
      status: 'error', 
      message: errorMessage,
      timestamp: new Date().toISOString() 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

