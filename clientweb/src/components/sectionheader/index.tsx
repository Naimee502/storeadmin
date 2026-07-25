import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: string;
  to?: string;
  children?: ReactNode; // e.g. category tabs rendered to the right on desktop
}

export default function SectionHeader({ eyebrow, title, subtitle, action = "View all", to = "/shop", children }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {children}
        <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
          {action} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
