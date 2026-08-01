import type { ReactNode } from "react";
import GlassCard from "./GlassCard";

type StateCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
};

export default function StateCard({
  label,
  value,
  hint,
  icon,
}: StateCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          {hint ? <p className="mt-2 text-sm text-slate-400">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-lime-300">
            {icon}
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
