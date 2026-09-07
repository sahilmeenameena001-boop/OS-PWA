"use client";
import { useMemo } from "react";
import { useRows, useProfile } from "@/lib/data/hooks";
import { buildMoneySnapshot, type MoneySnapshot } from "@/lib/money/safe-to-spend";
import { todayKey } from "@/lib/dates";

export function useMoneySnapshot(): MoneySnapshot | null {
  const profile = useProfile();
  const transactions = useRows("transactions");
  const bills = useRows("bills");
  const subscriptions = useRows("subscriptions");
  const debts = useRows("debts");
  const goals = useRows("savings_goals");
  const contributions = useRows("savings_contributions");
  return useMemo(() => {
    if (!profile || !transactions || !bills || !subscriptions || !debts || !goals || !contributions) return null;
    return buildMoneySnapshot({ profile, transactions, bills, subscriptions, debts, goals, contributions, todayKey: todayKey() });
  }, [profile, transactions, bills, subscriptions, debts, goals, contributions]);
}
