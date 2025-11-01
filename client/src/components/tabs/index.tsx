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
    <div className={`inline-flex rounded-md bg-gray-100 p-1 space-x-1 ${className || ""}`}>
      {children}
    </div>
  );
};

// Tabs trigger (single tab button)
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
        px-4 py-2 text-sm font-medium rounded-md transition-colors
        ${isActive
          ? "bg-white shadow text-blue-600"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"}
        ${className || ""}
      `}
    >
      {children}
    </button>
  );
};

// Tabs content (conditional rendering)
interface TabsContentProps {
  value: string;
  children: React.ReactNode;
}

export const TabsContent: React.FC<TabsContentProps> = ({ value, children }) => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");

  if (ctx.value !== value) return null;

  return <div className="mt-4">{children}</div>;
};
