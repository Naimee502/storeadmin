import React, { useEffect, useState } from "react";
import { Reorder, motion, useDragControls } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from "lucide-react";
import Modal from "../modal";

export interface ReorderCategory {
  id: string;
  categoryname: string;
  categorycode?: string;
}

interface CategoryReorderProps {
  isOpen: boolean;
  onClose: () => void;
  // Active categories in their current storefront order.
  categories: ReorderCategory[];
  // Receives all ids in order; reject on failure to keep the modal open.
  onSave: (ids: string[]) => Promise<unknown>;
  saving?: boolean;
  /** Defaults are for Categories; Sub Categories passes its own. */
  title?: string;
  hint?: React.ReactNode;
  emptyText?: string;
  /** Shown above the list — e.g. the parent-category picker. */
  header?: React.ReactNode;
  /** Changing it reloads the list from `categories` (new parent picked). */
  resetKey?: string;
}

const iconBtn =
  "p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer";

const Row: React.FC<{
  item: ReorderCategory;
  index: number;
  total: number;
  move: (from: number, to: number) => void;
}> = ({ item, index, total, move }) => {
  // Drag only from the grip so buttons and text selection still work.
  const controls = useDragControls();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="relative mb-1.5 flex select-none items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10 }}
    >
      <button
        type="button"
        aria-label={`Drag ${item.categoryname}`}
        onPointerDown={(e) => controls.start(e)}
        className="p-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={18} />
      </button>

      <span className="w-6 text-center text-[12px] font-semibold text-slate-500">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <div className="truncate text-[13px] font-medium text-slate-800">{item.categoryname}</div>
        {item.categorycode && <div className="text-[11px] text-slate-400">{item.categorycode}</div>}
      </div>

      <div className="flex items-center gap-0.5">
        <button type="button" title="Move to top" className={iconBtn} disabled={isFirst} onClick={() => move(index, 0)}>
          <ChevronsUp size={16} />
        </button>
        <button type="button" title="Move up" className={iconBtn} disabled={isFirst} onClick={() => move(index, index - 1)}>
          <ChevronUp size={16} />
        </button>
        <button type="button" title="Move down" className={iconBtn} disabled={isLast} onClick={() => move(index, index + 1)}>
          <ChevronDown size={16} />
        </button>
        <button type="button" title="Move to bottom" className={iconBtn} disabled={isLast} onClick={() => move(index, total - 1)}>
          <ChevronsDown size={16} />
        </button>
      </div>
    </Reorder.Item>
  );
};

/** Rearrange categories; this order is used by the client app and website. */
const CategoryReorder: React.FC<CategoryReorderProps> = ({
  isOpen,
  onClose,
  categories,
  onSave,
  saving,
  title = "Rearrange Categories",
  hint,
  emptyText = "No active categories.",
  header,
  resetKey,
}) => {
  const [items, setItems] = useState<ReorderCategory[]>(categories);

  // Start from the saved order every time the modal opens, or a different
  // parent is picked.
  useEffect(() => {
    if (isOpen) setItems(categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resetKey]);

  const move = (from: number, to: number) => {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const changed = items.some((c, i) => c.id !== categories[i]?.id);

  const handleSave = async () => {
    try {
      await onSave(items.map((c) => c.id));
      // With a parent picker, stay open for the next parent.
      if (!header) onClose();
    } catch {
      // Parent shows the error; keep the modal open so nothing is lost.
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <p className="mb-3 text-[12px] text-slate-500">
        Drag the <GripVertical size={14} className="inline -mt-0.5" /> handle or use the arrows.{" "}
        {hint ?? "This order is used on the app's Home & Shop and on the website."}
      </p>

      {header && <div className="mb-3">{header}</div>}

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">{emptyText}</div>
      ) : (
        // layoutScroll keeps drag positions correct after scrolling.
        <motion.div layoutScroll className="max-h-[55vh] overflow-y-auto pr-1">
          <Reorder.Group axis="y" values={items} onReorder={setItems} as="div">
            {items.map((item, index) => (
              <Row key={item.id} item={item} index={index} total={items.length} move={move} />
            ))}
          </Reorder.Group>
        </motion.div>
      )}

      <div className="flex justify-end gap-2 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!changed || saving}
          className="inline-flex h-8 items-center rounded-md bg-indigo-600 px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Order"}
        </button>
      </div>
    </Modal>
  );
};

export default CategoryReorder;
