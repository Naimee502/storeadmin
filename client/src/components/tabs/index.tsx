import React, { createContext, useContext } from "react";

// Context for Tabs
type TabsContextType = {
  value: string;
  onChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// Tabs container
interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ value, onValueChange, children, className }) => {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={`${className || ""}`}>{children}</div>
    </TabsContext.Provider>
  );
};

// Tabs list wrapper
interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({ children, className }) => {
  return (
    <div className={`inline-flex gap-1 rounded-md bg-slate-100 p-0.5 ${className || ""}`}>
      {children}
    </div>
  );
};

// Tabs trigger
interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({ value, children, className }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = ctx.value === value;

  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={`
        inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium transition-colors
        ${isActive
          ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"}
        ${className || ""}
      `}
    >
      {children}
    </button>
  );
};

// Tabs content
interface TabsContentProps {
  value: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return <div className="mt-3">{children}</div>;
};
