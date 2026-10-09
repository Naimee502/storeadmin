import React, { useEffect, useState } from "react";
import { Reorder, motion, useDragControls } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from "lucide-react";
import Modal from "../modal";
import Button from "../button";

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
  // Called with every id, first to last. Should reject on failure so the
  // modal stays open with the user's arrangement intact.
  onSave: (ids: string[]) => Promise<unknown>;
  saving?: boolean;
}

const iconBtn =
  "p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer";

const Row: React.FC<{
  item: ReorderCategory;
  index: number;
  total: number;
  move: (from: number, to: number) => void;
}> = ({ item, index, total, move }) => {
  // Drag starts only from the grip, so the arrow buttons and text selection
  // keep working normally on the rest of the row.
  const controls = useDragControls();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-3 px-3 py-2.5 mb-2 bg-white border border-gray-200 rounded-lg select-none"
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

      <span className="w-7 text-center text-sm font-semibold text-gray-500">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{item.categoryname}</div>
        {item.categorycode && <div className="text-xs text-gray-400">{item.categorycode}</div>}
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

/**
 * Rearrange categories — the order saved here is the order the client app
 * (Home/Shop category strip) and the website (nav, Home cards, Shop filter)
 * show them in. Nothing is saved until "Save Order".
 */
const CategoryReorder: React.FC<CategoryReorderProps> = ({ isOpen, onClose, categories, onSave, saving }) => {
  const [items, setItems] = useState<ReorderCategory[]>(categories);

  // Start from the saved order every time the modal opens.
  useEffect(() => {
    if (isOpen) setItems(categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
      onClose();
    } catch {
      // Parent shows the error; keep the modal open so nothing is lost.
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rearrange Categories" size="md">
      <p className="text-sm text-gray-500 mb-4">
        Drag the <GripVertical size={14} className="inline -mt-0.5" /> handle or use the arrows. This order is used on
        the app's Home &amp; Shop and on the website.
      </p>

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No active categories.</div>
      ) : (
        // Own scroll container with layoutScroll so drag positions stay
        // correct after the list is scrolled.
        <motion.div layoutScroll className="max-h-[55vh] overflow-y-auto pr-1">
          <Reorder.Group axis="y" values={items} onReorder={setItems} as="div">
            {items.map((item, index) => (
              <Row key={item.id} item={item} index={index} total={items.length} move={move} />
            ))}
          </Reorder.Group>
        </motion.div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!changed || saving}>
          {saving ? "Saving..." : "Save Order"}
        </Button>
      </div>
    </Modal>
  );
};

export default CategoryReorder;
