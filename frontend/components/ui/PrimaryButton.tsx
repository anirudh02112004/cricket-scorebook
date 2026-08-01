import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "accent" | "ghost" | "danger";
};

const toneClasses = {
  accent:
    "bg-lime-300 text-slate-950 hover:bg-lime-200 shadow-[0_12px_30px_rgba(190,242,100,0.18)]",
  ghost: "bg-white/6 text-white hover:bg-white/10 border border-white/10",
  danger: "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-500/20",
};

export default function PrimaryButton({
  children,
  tone = "accent",
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${toneClasses[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
