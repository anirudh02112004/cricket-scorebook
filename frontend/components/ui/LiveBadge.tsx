type LiveBadgeProps = {
  live?: boolean;
};

export default function LiveBadge({ live = true }: LiveBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${
        live
          ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
          : "border-white/10 bg-white/5 text-slate-400"
      }`}
    >
      <span className={`size-2 rounded-full ${live ? "bg-rose-400" : "bg-slate-500"}`} />
      {live ? "Live" : "Offline"}
    </span>
  );
}
