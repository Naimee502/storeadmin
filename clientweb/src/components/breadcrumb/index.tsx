import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";

interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <div className="border-b border-slate-100 bg-slate-50">
      <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 py-3 text-xs text-slate-500 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-1 hover:text-brand-700">
          <Home className="h-3.5 w-3.5" /> Home
        </Link>
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            {item.to ? (
              <Link to={item.to} className="hover:text-brand-700">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-ink-900">{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
