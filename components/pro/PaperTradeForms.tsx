"use client";

import { useActionState, useState } from "react";
import { resetAction, tradeAction, type PaperActionState } from "@/app/pro/paper/actions";
import { formatBaht, formatBahtWhole, formatWeight } from "@/lib/pro/format";

const INITIAL_STATE: PaperActionState = { error: "", message: "" };

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base tabular-nums text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50";
const LABEL_CLASS = "mb-1 block text-xs text-gray-500 dark:text-gray-400";
const QUICK_CLASS =
  "rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-400 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300";
const PANEL_CLASS = "flex flex-col gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800";

const QUICK_SHARES = [
  { label: "25%", share: 0.25 },
  { label: "50%", share: 0.5 },
  { label: "All", share: 1 },
];

function Feedback({ state }: { state: PaperActionState }) {
  return (
    <p aria-live="polite" className="min-h-5 text-sm">
      {state.error && <span className="text-red-600 dark:text-red-400">{state.error}</span>}
      {state.message && (
        <span className="text-emerald-700 dark:text-emerald-400">{state.message}</span>
      )}
    </p>
  );
}

function TradePanel({
  side,
  price,
  available,
  quotedAt,
}: {
  side: "buy" | "sell";
  /** Dealer SELL price for the buy panel, dealer BUY price for the sell panel. */
  price: number;
  /** Cash available (buy) or baht-weight held (sell). */
  available: number;
  quotedAt: string;
}) {
  const isBuy = side === "buy";
  const decimals = isBuy ? 2 : 6;
  const [value, setValue] = useState("");

  const [state, formAction, pending] = useActionState(
    async (prev: PaperActionState, formData: FormData) => {
      const next = await tradeAction(prev, formData);
      if (next.message) setValue("");
      return next;
    },
    INITIAL_STATE,
  );

  const amount = Number(value);
  const hasAmount = value !== "" && Number.isFinite(amount) && amount > 0;
  const nothingAvailable = available <= 0;

  let estimate = "";
  if (hasAmount) {
    estimate = isBuy
      ? `About ${formatWeight(amount / price)} baht-weight at ${formatBahtWhole(price)}`
      : `About ${formatBaht(amount * price)} at ${formatBahtWhole(price)}`;
  }

  return (
    <form action={formAction} className={PANEL_CLASS}>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-50">
        {isBuy ? "Buy gold" : "Sell gold"}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isBuy ? "You pay the dealer's selling price: " : "You get the dealer's buying price: "}
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-50">
          {formatBahtWhole(price)}
        </span>{" "}
        per baht-weight
      </p>

      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="quotedAt" value={quotedAt} />

      <div>
        <label htmlFor={`paper-${side}-value`} className={LABEL_CLASS}>
          {isBuy
            ? `Cash to spend (฿) - you have ${formatBaht(available)}`
            : `Gold to sell (baht-weight) - you hold ${formatWeight(available)}`}
        </label>
        <input
          id={`paper-${side}-value`}
          name="value"
          type="number"
          inputMode="decimal"
          required
          min={0}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={nothingAvailable}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_SHARES.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={nothingAvailable}
            onClick={() =>
              // Round down, so a quick amount is never more than what is available.
              setValue(
                q.share === 1
                  ? available.toFixed(decimals)
                  : (Math.floor(available * q.share * 10 ** decimals) / 10 ** decimals).toFixed(decimals),
              )
            }
            className={QUICK_CLASS}
          >
            {q.label}
          </button>
        ))}
      </div>

      <p className="min-h-5 text-xs text-gray-500 dark:text-gray-400">{estimate}</p>

      <button
        type="submit"
        disabled={pending || nothingAvailable}
        className={`rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
          isBuy
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-gray-800 hover:bg-gray-900 dark:bg-gray-600 dark:hover:bg-gray-500"
        }`}
      >
        {pending ? "Working..." : isBuy ? "Buy" : "Sell"}
      </button>

      <Feedback state={state} />
    </form>
  );
}

export function PaperTradeForms({
  cash,
  position,
  buyPrice,
  sellPrice,
  quotedAt,
}: {
  cash: number;
  /** Baht-weight held. */
  position: number;
  /** Dealer buys from you at this price. */
  buyPrice: number;
  /** Dealer sells to you at this price. */
  sellPrice: number;
  /** ISO time of the price row shown, sent back so a stale page cannot trade. */
  quotedAt: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TradePanel side="buy" price={sellPrice} available={cash} quotedAt={quotedAt} />
      <TradePanel side="sell" price={buyPrice} available={position} quotedAt={quotedAt} />
    </div>
  );
}

export function PaperResetForm() {
  const [state, formAction, pending] = useActionState(resetAction, INITIAL_STATE);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" name="confirm" value="yes" className="mt-1 accent-red-600" />
        <span>
          Delete every trade and start again with ฿100,000. This cannot be undone.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:border-red-400 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
      >
        {pending ? "Resetting..." : "Reset the account"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
