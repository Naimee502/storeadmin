import { useEffect, useState } from "react";

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { hours, minutes, seconds };
}

// Countdown to the next midnight — purely a UI touch for the "Deal of the
// Day" banner; swap the target for a real campaign end date later.
export default function DealTimer() {
  const [target] = useState(() => {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  });
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const box = (value: number, label: string) => (
    <div className="flex flex-col items-center">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-white/15 text-lg font-bold text-white sm:h-12 sm:w-12">
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-white/70">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-2.5">
      {box(remaining.hours, "Hrs")}
      <span className="pb-4 text-white/50">:</span>
      {box(remaining.minutes, "Min")}
      <span className="pb-4 text-white/50">:</span>
      {box(remaining.seconds, "Sec")}
    </div>
  );
}
