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
  currentstock?: number;
  productvariants?: ProductVariant[];
}

interface Transfer {
  tobranchid?: string;
  frombranchid?: string;
  status?: boolean;
  productid?: string;
  transferqty?: number;
  variantid?: string | { id?: string };
  transferunitid?: string | { id?: string };
}

interface InvoiceItem {
  productserviceid?: string | { id?: string };
  variantid?: string | { id?: string };
  qty?: number;
  unitqty?: number;
  salesunitid?: string | { id?: string };
  purchaseunitid?: string | { id?: string };
}

interface SalesInvoice {
  id: string;
  billdate?: string;
  products?: InvoiceItem[];
  productservice?: InvoiceItem[];
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

      const variantStockMap: Record<string, number> = {};
      const variantIndex: Record<string, ProductVariant> = {};

      for (const product of products) {
        if (product.productvariants?.length) {
          for (const variant of product.productvariants) {
            variantStockMap[variant.id] = variant.currentstock ?? 0;
            variantIndex[variant.id] = variant;
          }
        } else if (product.id) {
          variantStockMap[product.id] = product.currentstock ?? 0;
        }
      }

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

      const resolveVariantId = (v?: string | { id?: string } | undefined) =>
        typeof v === "string" ? v : v?.id;

      for (const inv of invoices) {
        const items: InvoiceItem[] = inv.products ?? inv.productservice ?? [];
        for (const p of items) {
          const variantId = resolveVariantId(p.variantid);
          if (!variantId) continue;
          const variant = variantIndex[variantId];
          const unitRef = (p as any).salesunitid ?? (p as any).unitid ?? undefined;
          const baseQty = (p.qty ?? 0) * (p.unitqty ?? 1);
          const factor = getConversionFactor(variant, unitRef);
          const qtyInBase = baseQty * factor;
          if (variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] -= qtyInBase;
            totalSalesStockOut += qtyInBase;
          } else {
            totalSalesStockOut += qtyInBase;
          }
        }
      }

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
            variantStockMap[variantId] = qtyInBase;
          }
        }
      }

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
    labels: ["Purchase In", "Sales Out", "Transfers Out", "Current Stock"],
    datasets: [
      {
        data: [purchaseStockIn, salesStockOut, transferStockOut, currentStock],
        backgroundColor: [
          "rgba(16, 185, 129, 0.7)",
          "rgba(239, 68, 68, 0.7)",
          "rgba(245, 158, 11, 0.7)",
          "rgba(99, 102, 241, 0.7)",
        ],
        borderColor: [
          "rgba(5, 150, 105, 1)",
          "rgba(220, 38, 38, 1)",
          "rgba(217, 119, 6, 1)",
          "rgba(79, 70, 229, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" as const, labels: { boxWidth: 12, font: { size: 10 } } },
    },
  };

  return (
    <div className="bg-white p-3.5 rounded border border-gray-200 shadow-2xs font-sans flex flex-col justify-between h-80 sm:h-96">
      <div>
        <h3 className="text-xs font-bold text-[#2c3e50] mb-1 capitalize tracking-wider">Inventory Movement</h3>
        <p className="text-[10px] text-gray-500 mb-2">Real-time stock flow distribution</p>
      </div>
      <div className="flex-1 relative min-h-[160px] flex items-center justify-center py-2">
        <Doughnut data={doughnutData} options={options} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-left pt-2 border-t border-gray-100">
        <div className="p-1.5 bg-emerald-50 rounded border border-emerald-100">
          <p className="text-[9px] font-bold text-emerald-800 capitalize tracking-tight leading-none">Purchased In</p>
          <p className="text-sm font-black text-emerald-900 mt-1 leading-none">{purchaseStockIn}</p>
        </div>
        <div className="p-1.5 bg-rose-50 rounded border border-rose-100">
          <p className="text-[9px] font-bold text-rose-800 capitalize tracking-tight leading-none">Sold Out</p>
          <p className="text-sm font-black text-rose-900 mt-1 leading-none">{salesStockOut}</p>
        </div>
        <div className="p-1.5 bg-amber-50 rounded border border-amber-100">
          <p className="text-[9px] font-bold text-amber-800 capitalize tracking-tight leading-none">Transfers Out</p>
          <p className="text-sm font-black text-amber-900 mt-1 leading-none">{transferStockOut}</p>
        </div>
        <div className="p-1.5 bg-indigo-50 rounded border border-indigo-100">
          <p className="text-[9px] font-bold text-indigo-800 capitalize tracking-tight leading-none">Current Stock</p>
          <p className="text-sm font-black text-indigo-900 mt-1 leading-none">{currentStock}</p>
        </div>
      </div>
    </div>
  );
};

export default StockInOutDoughnutChart;
