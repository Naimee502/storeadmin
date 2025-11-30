import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProductVariant {
  id: string;
  currentstock?: number;
  unitconversions?: { unitid: string | { id?: string }; factor?: number }[];
}

interface Product {
  id: string;
  branchid?: string;
  currentstock?: number; // fallback if no variants
  productvariants?: ProductVariant[];
}

interface Transfer {
  tobranchid?: string;
  frombranchid?: string;
  status?: boolean;
  productid?: string;
  transferqty?: number;
  variantid?: string | { id?: string };
  transferunitid?: string | { id?: string }; // possible unit on transfer
}

interface InvoiceItem {
  productserviceid?: string | { id?: string };
  variantid?: string | { id?: string };
  qty?: number;
  unitqty?: number;
  salesunitid?: string | { id?: string };
  purchaseunitid?: string | { id?: string };
  // keep flexible for other shapes
}

interface SalesInvoice {
  id: string;
  billdate?: string;
  products?: InvoiceItem[]; // original API property
  productservice?: InvoiceItem[]; // older name
}

interface PurchaseInvoice {
  products?: InvoiceItem[];
  productservice?: InvoiceItem[];
}

interface Props {
  products?: Product[];
  transfers?: Transfer[];
  invoices?: SalesInvoice[];
  purchaseInvoices?: PurchaseInvoice[];
  branchId?: string;
}

const StockInOutDoughnutChart: React.FC<Props> = ({
  products = [],
  transfers = [],
  invoices = [],
  purchaseInvoices = [],
  branchId = "",
}) => {
  const { purchaseStockIn, salesStockOut, transferStockOut, currentStock } =
    useMemo(() => {
      let totalPurchaseStockIn = 0;
      let totalSalesStockOut = 0;
      let totalTransferStockOut = 0;

      // Step 1: Build variant stock map and an index of variant -> variant object for conversions
      const variantStockMap: Record<string, number> = {};
      const variantIndex: Record<string, ProductVariant> = {};

      for (const product of products) {
        if (product.productvariants?.length) {
          for (const variant of product.productvariants) {
            variantStockMap[variant.id] = variant.currentstock ?? 0;
            variantIndex[variant.id] = variant;
          }
        } else if (product.id) {
          // no variants: use product.id as key
          variantStockMap[product.id] = product.currentstock ?? 0;
          // no variantIndex entry for product-level fallback
        }
      }

      // helper to get factor to base unit for a given variant and a given unitId
      const getConversionFactor = (
        variant: ProductVariant | undefined,
        unitId?: string | { id?: string } | undefined
      ) => {
        if (!variant || !variant.unitconversions || !unitId) return 1;
        const uid = typeof unitId === "string" ? unitId : unitId.id;
        if (!uid) return 1;
        const conv = variant.unitconversions.find((c) => {
          const cUnitId = typeof c.unitid === "string" ? c.unitid : c.unitid?.id;
          return cUnitId === uid;
        });
        return conv?.factor ?? 1;
      };

      // helper to resolve variant id consistently
      const resolveVariantId = (v?: string | { id?: string } | undefined) =>
        typeof v === "string" ? v : v?.id;

      // Step 2: Process Sales Invoices (subtract from variantStockMap, apply conversion)
      for (const inv of invoices) {
        const items: InvoiceItem[] = inv.products ?? inv.productservice ?? [];
        for (const p of items) {
          const variantId = resolveVariantId(p.variantid);
          if (!variantId) continue;
          const variant = variantIndex[variantId];
          // determine unit used in sale (salesunitid or fallback to base)
          const unitRef = (p as any).salesunitid ?? (p as any).unitid ?? undefined;
          const baseQty = (p.qty ?? 0) * (p.unitqty ?? 1);
          const factor = getConversionFactor(variant, unitRef);
          const qtyInBase = baseQty * factor;
          if (variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] -= qtyInBase;
            totalSalesStockOut += qtyInBase;
          } else {
            // if variant not in map but present elsewhere, still count sales out
            totalSalesStockOut += qtyInBase;
          }
        }
      }

      // Step 3: Transfers (subtract when frombranchid === branchId)
      for (const t of transfers) {
        if (t.status && t.frombranchid === branchId) {
          const variantId = resolveVariantId(t.variantid);
          if (!variantId) continue;
          const variant = variantIndex[variantId];
          const baseQty = t.transferqty ?? 0;
          const factor = getConversionFactor(variant, t.transferunitid);
          const qtyInBase = baseQty * factor;
          if (variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] -= qtyInBase;
            totalTransferStockOut += qtyInBase;
          } else {
            totalTransferStockOut += qtyInBase;
          }
        }
      }

      // Step 4: Purchase Stock In — convert purchase units to base unit and ADD to variantStockMap
      for (const pInvoice of purchaseInvoices) {
        const items: InvoiceItem[] = pInvoice.products ?? pInvoice.productservice ?? [];
        for (const p of items) {
          const variantId = resolveVariantId(p.variantid);
          const baseQty = (p.qty ?? 0) * (p.unitqty ?? 1);
          const variant = variantId ? variantIndex[variantId] : undefined;
          const unitRef = (p as any).purchaseunitid ?? (p as any).unitid ?? undefined;
          const factor = getConversionFactor(variant, unitRef);
          const qtyInBase = baseQty * factor;
          totalPurchaseStockIn += qtyInBase;
          if (variantId && variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] += qtyInBase;
          } else if (variantId) {
            // create entry if missing so currentStock reflects it
            variantStockMap[variantId] = qtyInBase;
          }
        }
      }

      // Step 5: Calculate total current stock from variantStockMap
      const totalCurrentStock = products.reduce((sum, p) => {
        if (p.productvariants?.length) {
          return (
            sum +
            p.productvariants.reduce(
              (vsum, v) => vsum + (v.currentstock ?? 0),
              0
            )
          );
        }
        return sum + (p.currentstock ?? 0);
      }, 0);

      return {
        purchaseStockIn: totalPurchaseStockIn,
        salesStockOut: totalSalesStockOut,
        transferStockOut: totalTransferStockOut,
        currentStock: totalCurrentStock,
      };
    }, [products, transfers, invoices, purchaseInvoices, branchId]);

  const doughnutData = {
    labels: ["Purchase Stock In", "Sales Stock Out", "Transfer Stock Out", "Current Stock"],
    datasets: [
      {
        data: [purchaseStockIn, salesStockOut, transferStockOut, currentStock],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(255, 99, 132, 0.6)",
          "rgba(255, 159, 64, 0.6)",
          "rgba(99, 102, 241, 0.6)"
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 99, 132, 1)",
          "rgba(255, 159, 64, 1)",
          "rgba(79, 70, 229, 1)"
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📦 Stock In / Out Summary</h2>
      <Doughnut data={doughnutData} />
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
        <div className="bg-green-50 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Purchase Stock In</p>
          <p className="text-2xl font-bold text-green-600">{purchaseStockIn}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Sales Stock Out</p>
          <p className="text-2xl font-bold text-red-600">{salesStockOut}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Transfer Stock Out</p>
          <p className="text-2xl font-bold text-orange-500">{transferStockOut}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl p-3 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Current Stock</p>
          <p className="text-2xl font-bold text-indigo-600">{currentStock}</p>
        </div>
      </div>
    </div>
  );
};

export default StockInOutDoughnutChart;
