import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-opens a cash register for a user when their jornada starts.
 * Uses the last closed register's next_day_fund as opening amount (if available),
 * otherwise falls back to config's fixed amount or 0.
 */
export async function autoOpenCaja({
  userId,
  branchId,
  businessId,
}: {
  userId: string;
  branchId: string;
  businessId: string;
}): Promise<void> {
  // Check if user already has an open register
  const { data: existing } = await supabase
    .from("cash_registers")
    .select("id")
    .eq("branch_id", branchId)
    .eq("user_id", userId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (existing) return; // Already has an open register

  // Get config for opening amount
  const { data: config } = await supabase
    .from("cash_register_config")
    .select("opening_type, fixed_opening_amount, mode")
    .eq("branch_id", branchId)
    .maybeSingle();

  // Get last closed fund
  const { data: lastClosed } = await supabase
    .from("cash_registers")
    .select("next_day_fund")
    .eq("branch_id", branchId)
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let openingAmount = 0;
  const lastFund = Number(lastClosed?.next_day_fund || 0);

  if (lastFund > 0) {
    openingAmount = lastFund;
  } else if (config?.opening_type === "fixed") {
    openingAmount = Number(config.fixed_opening_amount) || 0;
  }

  await supabase.from("cash_registers").insert({
    branch_id: branchId,
    business_id: businessId,
    user_id: userId,
    opening_amount: openingAmount,
  });
}
