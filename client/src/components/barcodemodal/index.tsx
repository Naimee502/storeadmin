// components/BarcodeModal.tsx
import React, { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import Button from "../button";

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (qty: number, barcode?: string) => void;
  barcodeOptions?: { label: string, barcode: string }[];
}

const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, onClose, onPrint, barcodeOptions }) => {
  const [qty, setQty] = useState<number>(1);
  const [selectedBarcode, setSelectedBarcode] = useState<string>("");

  useEffect(() => {
    if (barcodeOptions?.length) {
      setSelectedBarcode(barcodeOptions[0].barcode);
    }
  }, [barcodeOptions, isOpen]);

  const handlePrint = () => {
  if (qty <= 0) {
    alert("Please enter a quantity greater than 0.");
    return;
  }

  onPrint(qty, selectedBarcode);
  onClose();
  setQty(1);
};

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed z-50 inset-0 flex items-center justify-center">
      <div className="bg-white rounded p-4 shadow-lg">
        <Dialog.Title>Enter Barcode Quantity</Dialog.Title>
        {barcodeOptions && barcodeOptions.length > 0 && (
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-700">Select Unit</label>
            <select
              className="border mt-1 p-2 w-full rounded"
              value={selectedBarcode}
              onChange={(e) => setSelectedBarcode(e.target.value)}
            >
              {barcodeOptions.map((opt, i) => (
                <option key={i} value={opt.barcode}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700">Enter Quantity</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            placeholder="0"
            className="border mt-1 p-2 w-full rounded"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} variant="outline">Cancel</Button>
          <Button onClick={handlePrint} variant="outline">Print</Button>
        </div>
      </div>
    </Dialog>
  );
};

export default BarcodeModal;
