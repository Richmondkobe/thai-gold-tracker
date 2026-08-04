import { formatThaiChange } from "@/lib/thai-date";

export function ChangeIndicator({ value, label }: { value: number; label: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const colorClass = isUp
    ? "text-emerald-600 dark:text-emerald-400"
    : isDown
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500 dark:text-gray-400";
  const arrow = isUp ? "▲" : isDown ? "▼" : "–";

  return (
    <span className="inline-flex items-baseline gap-1 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-semibold ${colorClass}`}>
        {arrow} {formatThaiChange(value)}
      </span>
    </span>
  );
}
