"use server";

import { refresh } from "next/cache";
import { getLatestPrices } from "@/lib/gold-price-queries";
import { requireProSession } from "@/lib/pro/auth";
import { formatBaht, formatBahtWhole, formatWeight } from "@/lib/pro/format";
import { computeAccount, planBuy, planSell } from "@/lib/pro/paper";
import { deleteAllPaperTrades, insertPaperTrade, listPaperTrades } from "@/lib/pro/paper-store";

export interface PaperActionState {
  error: string;
  message: string;
}

const failed = (error: string): PaperActionState => ({ error, message: "" });
const done = (message: string): PaperActionState => ({ error: "", message });

const TABLE_MISSING_ERROR = "The paper_trades table has not been created yet.";

/**
 * One pretend buy or sell. The price is never taken from the form: it is read
 * again here, from the latest stored announcement. The form only says which
 * price the user was looking at (`quotedAt`); if a newer price has arrived
 * since, nothing is traded and the user is shown the new price first.
 */
export async function tradeAction(
  _prev: PaperActionState,
  formData: FormData,
): Promise<PaperActionState> {
  await requireProSession();

  const side = formData.get("side");
  const quotedAt = formData.get("quotedAt");
  const value = Number(formData.get("value"));
  if ((side !== "buy" && side !== "sell") || typeof quotedAt !== "string") {
    return failed("Something was missing from the form. Reload the page and try again.");
  }

  let latest;
  let stored;
  try {
    [[latest], stored] = await Promise.all([getLatestPrices(1), listPaperTrades()]);
  } catch (err) {
    console.error("[pro/paper] load failed:", err instanceof Error ? err.message : err);
    return failed("Could not load the price or the account. Try again.");
  }

  if (stored.status === "missing-table") return failed(TABLE_MISSING_ERROR);
  if (!latest) return failed("No price is available right now.");

  if (latest.fetchedAt.toISOString() !== quotedAt) {
    refresh();
    return failed(
      `The price has just changed: you buy at ${formatBahtWhole(latest.barSell)}, you sell at ${formatBahtWhole(latest.barBuy)}. Nothing was traded. Check the new price and press the button again.`,
    );
  }

  const account = computeAccount(stored.trades);
  const planned =
    side === "buy"
      ? planBuy(account, value, latest.barSell)
      : planSell(account, value, latest.barBuy);
  if (!planned.ok) return failed(planned.error);

  const nextSeq = stored.trades.reduce((max, t) => Math.max(max, t.seq), 0) + 1;
  let inserted;
  try {
    inserted = await insertPaperTrade(nextSeq, planned.order, latest.announcedAt);
  } catch (err) {
    console.error("[pro/paper] insert failed:", err instanceof Error ? err.message : err);
    return failed("Could not save the trade. Nothing was traded. Try again.");
  }

  refresh();
  if (inserted.status === "conflict") {
    return failed(
      "Another trade was recorded at the same moment, so this one was not made. Check the account and try again.",
    );
  }

  const { order } = planned;
  return done(
    `${order.side === "buy" ? "Bought" : "Sold"} ${formatWeight(order.bahtWeight)} baht-weight at ${formatBahtWhole(order.price)} for ${formatBaht(order.amount)}.`,
  );
}

/** Deletes every paper trade - back to the starting cash. Needs the confirm box ticked. */
export async function resetAction(
  _prev: PaperActionState,
  formData: FormData,
): Promise<PaperActionState> {
  await requireProSession();

  if (formData.get("confirm") !== "yes") {
    return failed("Tick the box to confirm, then press the button again.");
  }

  try {
    await deleteAllPaperTrades();
  } catch (err) {
    console.error("[pro/paper] reset failed:", err instanceof Error ? err.message : err);
    return failed("Could not reset the account. Try again.");
  }

  refresh();
  return done("The account was reset.");
}
