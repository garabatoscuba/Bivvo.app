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
    // Validate auth
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

    // Verify user is owner of this business
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Check owner role
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

    // Helper to delete and log errors without blocking
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

    // Get all branch IDs for this business (needed for tables without business_id)
    const { data: branches } = await adminClient
      .from("branches")
      .select("id")
      .eq("business_id", business_id);
    const branchIds = (branches || []).map((b: any) => b.id);

    // 1. audit_logs
    await safeDelete("audit_logs", { business_id });

    // 2. inventory_counts (may not exist yet)
    try {
      const { error } = await adminClient.from("inventory_counts").delete().eq("business_id", business_id);
      if (error) console.error("inventory_counts:", error.message);
    } catch (_) {}

    // 3. accounting_asset_interventions & maintenances via asset_id
    const { data: assets } = await adminClient
      .from("accounting_assets")
      .select("id")
      .eq("business_id", business_id);
    const assetIds = (assets || []).map((a: any) => a.id);

    if (assetIds.length > 0) {
      await safeDeleteIn("accounting_asset_interventions", "asset_id", assetIds);
      await safeDeleteIn("accounting_asset_maintenances", "asset_id", assetIds);
    }

    // 4. accounting_assets
    await safeDelete("accounting_assets", { business_id });

    // 5. accounting_expenses
    await safeDelete("accounting_expenses", { business_id });

    // 6. employee_salary_records
    await safeDelete("employee_salary_records", { business_id });

    // 7. daily_reports
    await safeDelete("daily_reports", { business_id });

    // 8. jornadas (uses sucursal_id, no business_id)
    await safeDeleteIn("jornadas", "sucursal_id", branchIds);

    // 9. cash_register_movements
    await safeDelete("cash_register_movements", { business_id });

    // 10. cash_registers
    await safeDelete("cash_registers", { business_id });

    // 11. treasury_movements
    await safeDelete("treasury_movements", { business_id });

    // 12. treasury_pending_entries
    await safeDelete("treasury_pending_entries", { business_id });

    // 13. product_stock_entries
    await safeDelete("product_stock_entries", { business_id });

    // 14. sale_items via sale_id (sales uses branch_id, no business_id)
    const { data: salesData } = await adminClient
      .from("sales")
      .select("id")
      .in("branch_id", branchIds);
    const saleIds = (salesData || []).map((s: any) => s.id);

    if (saleIds.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < saleIds.length; i += batchSize) {
        const batch = saleIds.slice(i, i + batchSize);
        await safeDeleteIn("sale_items", "sale_id", batch);
      }
    }

    // 15. sales (uses branch_id)
    await safeDeleteIn("sales", "branch_id", branchIds);

    // 16. daily_copies
    await safeDelete("daily_copies", { business_id });

    // 17. tip_entries (if exists)
    try {
      const { error } = await adminClient.from("tip_entries").delete().eq("business_id", business_id);
      if (error) console.error("tip_entries:", error.message);
    } catch (_) {}

    // 18. inventory_movements (uses branch_id, no business_id)
    await safeDeleteIn("inventory_movements", "branch_id", branchIds);

    // 19. notifications
    await safeDelete("notifications", { business_id });

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
