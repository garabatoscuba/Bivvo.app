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

    // 1. audit_logs
    await safeDelete("audit_logs", { business_id });

    // 2. inventory_counts (may not exist yet, ignore errors)
    try {
      const { error } = await adminClient.from("inventory_counts").delete().eq("business_id", business_id);
      if (error) console.error("inventory_counts:", error.message);
    } catch (_) { /* table may not exist */ }

    // 3. accounting_asset_interventions via asset_id
    const { data: assets } = await adminClient
      .from("accounting_assets")
      .select("id")
      .eq("business_id", business_id);
    const assetIds = (assets || []).map((a: any) => a.id);

    if (assetIds.length > 0) {
      // Delete interventions
      try {
        const { error } = await adminClient
          .from("accounting_asset_interventions")
          .delete()
          .in("asset_id", assetIds);
        if (error) {
          console.error("accounting_asset_interventions:", error.message);
          errors.push(`accounting_asset_interventions: ${error.message}`);
        }
      } catch (e: any) { errors.push(`accounting_asset_interventions: ${e.message}`); }

      // Delete maintenances
      try {
        const { error } = await adminClient
          .from("accounting_asset_maintenances")
          .delete()
          .in("asset_id", assetIds);
        if (error) {
          console.error("accounting_asset_maintenances:", error.message);
          errors.push(`accounting_asset_maintenances: ${error.message}`);
        }
      } catch (e: any) { errors.push(`accounting_asset_maintenances: ${e.message}`); }
    }

    // 4. accounting_assets
    await safeDelete("accounting_assets", { business_id });

    // 5. accounting_expenses
    await safeDelete("accounting_expenses", { business_id });

    // 6. employee_salary_records
    await safeDelete("employee_salary_records", { business_id });

    // 7. daily_reports
    await safeDelete("daily_reports", { business_id });

    // 8. jornadas
    await safeDelete("jornadas", { business_id });

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

    // 14. sale_items via sale_id
    const { data: salesData } = await adminClient
      .from("sales")
      .select("id")
      .eq("business_id", business_id);
    const saleIds = (salesData || []).map((s: any) => s.id);

    if (saleIds.length > 0) {
      // Batch delete sale_items
      const batchSize = 200;
      for (let i = 0; i < saleIds.length; i += batchSize) {
        const batch = saleIds.slice(i, i + batchSize);
        try {
          const { error } = await adminClient.from("sale_items").delete().in("sale_id", batch);
          if (error) {
            console.error("sale_items batch:", error.message);
            errors.push(`sale_items: ${error.message}`);
          }
        } catch (e: any) { errors.push(`sale_items: ${e.message}`); }
      }
    }

    // 15. sales
    await safeDelete("sales", { business_id });

    // 16. daily_copies
    await safeDelete("daily_copies", { business_id });

    // 17. tip_entries (if exists)
    try {
      const { error } = await adminClient.from("tip_entries").delete().eq("business_id", business_id);
      if (error) console.error("tip_entries:", error.message);
    } catch (_) { /* may not exist */ }

    // 18. inventory_movements via branch
    const { data: branches } = await adminClient
      .from("branches")
      .select("id")
      .eq("business_id", business_id);
    const branchIds = (branches || []).map((b: any) => b.id);

    if (branchIds.length > 0) {
      for (const bid of branchIds) {
        try {
          const { error } = await adminClient.from("inventory_movements").delete().eq("branch_id", bid);
          if (error) console.error("inventory_movements:", error.message);
        } catch (_) { /* ignore */ }
      }
    }

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
