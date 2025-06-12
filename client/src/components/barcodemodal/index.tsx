// components/BarcodeModal.tsx
import React, { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import Button from "../button";

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (qty: number) => void;
}

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, onPrint }) => {
  const [qty, setQty] = useState<number>(1);

  const handlePrint = () => {
  if (qty <= 0) {
    alert("Please enter a quantity greater than 0.");
    return;
  }

  onPrint(qty);
  onClose();
  setQty(1);
};

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0 flex items-center justify-center">
      <div className="bg-white rounded p-4 shadow-lg">
        <Dialog.Title>Enter Barcode Quantity</Dialog.Title>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          placeholder="0"
          className="border mt-2 p-1 w-full"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button onClick={handlePrint} variant="outline">Print</Button>
        </div>
      </div>
    </Dialog>
  );
};

export default BarcodeModal;
