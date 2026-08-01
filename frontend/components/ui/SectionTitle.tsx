import type { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export default function SectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: SectionTitleProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-300/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
