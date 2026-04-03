import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { business_id } = await req.json();
    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify owner
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_id")
      .eq("user_id", userId)
      .single();

    if (!profile || profile.business_id !== business_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only owners can reset data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: string[] = [];

    const safeDelete = async (table: string, filter: Record<string, any>) => {
      try {
        let query = adminClient.from(table).delete();
        for (const [key, value] of Object.entries(filter)) {
          query = query.eq(key, value);
        }
        const { error } = await query;
        if (error) {
          console.error(`Error deleting from ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
        }
      } catch (e: any) {
        console.error(`Exception deleting from ${table}:`, e.message);
        errors.push(`${table}: ${e.message}`);
      }
    };

    const safeDeleteIn = async (table: string, column: string, values: string[]) => {
      if (values.length === 0) return;
      try {
        const { error } = await adminClient.from(table).delete().in(column, values);
        if (error) {
          console.error(`Error deleting from ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
        }
      } catch (e: any) {
        console.error(`Exception deleting from ${table}:`, e.message);
        errors.push(`${table}: ${e.message}`);
      }
    };

    // Get branch IDs
    const { data: branches } = await adminClient
      .from("branches")
      .select("id")
      .eq("business_id", business_id);
    const branchIds = (branches || []).map((b: any) => b.id);

    // --- Delete children before parents ---

    // audit_logs
    await safeDelete("audit_logs", { business_id });

    // inventory_counts
    await safeDelete("inventory_counts", { business_id });

    // accounting assets children
    const { data: assets } = await adminClient
      .from("accounting_assets")
      .select("id")
      .eq("business_id", business_id);
    const assetIds = (assets || []).map((a: any) => a.id);
    if (assetIds.length > 0) {
      await safeDeleteIn("accounting_asset_interventions", "asset_id", assetIds);
      await safeDeleteIn("accounting_asset_maintenances", "asset_id", assetIds);
    }
    await safeDelete("accounting_assets", { business_id });
    await safeDelete("accounting_expenses", { business_id });

    // employee_salary_records
    await safeDelete("employee_salary_records", { business_id });

    // daily_reports
    await safeDelete("daily_reports", { business_id });

    // jornadas
    await safeDeleteIn("jornadas", "sucursal_id", branchIds);

    // cash_register_movements & cash_registers
    await safeDelete("cash_register_movements", { business_id });
    await safeDelete("cash_registers", { business_id });

    // treasury
    await safeDelete("treasury_movements", { business_id });
    await safeDelete("treasury_pending_entries", { business_id });

    // product_stock_entries
    await safeDelete("product_stock_entries", { business_id });

    // sale_items -> sales
    const { data: salesData } = await adminClient
      .from("sales")
      .select("id")
      .in("branch_id", branchIds);
    const saleIds = (salesData || []).map((s: any) => s.id);
    if (saleIds.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < saleIds.length; i += batchSize) {
        await safeDeleteIn("sale_items", "sale_id", saleIds.slice(i, i + batchSize));
      }
    }
    await safeDeleteIn("sales", "branch_id", branchIds);

    // daily_copies
    await safeDelete("daily_copies", { business_id });

    // tip_entries
    try {
      await adminClient.from("tip_entries").delete().eq("business_id", business_id);
    } catch (_) {}

    // inventory_movements
    await safeDeleteIn("inventory_movements", "branch_id", branchIds);

    // notifications
    await safeDelete("notifications", { business_id });

    // --- NEW: service_entries ---
    await safeDelete("service_entries", { business_id });

    // --- NEW: kitchen_orders ---
    await safeDelete("kitchen_orders", { business_id });

    // --- NEW: print_job_items -> print_jobs (children first) ---
    const { data: printJobs } = await adminClient
      .from("print_jobs")
      .select("id")
      .eq("business_id", business_id);
    const printJobIds = (printJobs || []).map((p: any) => p.id);
    if (printJobIds.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < printJobIds.length; i += batchSize) {
        await safeDeleteIn("print_job_items", "print_job_id", printJobIds.slice(i, i + batchSize));
      }
    }
    await safeDelete("print_jobs", { business_id });

    // --- NEW: print_ink_usage ---
    await safeDelete("print_ink_usage", { business_id });

    // --- NEW: print_active_sheets ---
    await safeDeleteIn("print_active_sheets", "branch_id", branchIds);

    // --- NEW: print_shrinkage ---
    await safeDelete("print_shrinkage", { business_id });

    // --- NEW: raw_material_entries ---
    await safeDelete("raw_material_entries", { business_id });

    // --- NEW: raw_material_transfers ---
    await safeDelete("raw_material_transfers", { business_id });

    return new Response(
      JSON.stringify({ success: true, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Reset error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
