import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function GlassCard({
  children,
  className = "",
  ...props
}: GlassCardProps) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-[#121725]/70 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
