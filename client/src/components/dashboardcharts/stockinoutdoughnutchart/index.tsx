import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// Updated type-safe interfaces
interface ProductVariant {
  id: string;
  currentstock?: number;
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
}

// Accept both SalesInvoiceProduct and InvoiceProduct
interface SalesInvoiceProduct {
  productserviceid?: string; // optional
  variantid?: string | { id: string };
  qty?: number;
  unitqty?: number;
}

interface SalesInvoice {
  id: string;
  billdate?: string;
  products?: SalesInvoiceProduct[]; // original API property
}

interface PurchaseInvoice {
  products?: SalesInvoiceProduct[];
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

      // Step 1: Build variant stock map
      const variantStockMap: Record<string, number> = {};

      for (const product of products) {
        if (product.productvariants?.length) {
          for (const variant of product.productvariants) {
            variantStockMap[variant.id] = variant.currentstock ?? 0;
          }
        } else if (product.id) {
          variantStockMap[product.id] = product.currentstock ?? 0;
        }
      }

      // Step 2: Sales Invoice quantities
      for (const inv of invoices) {
        // Support both `products` (SalesInvoice) and `productservice` (old Invoice)
        const items = inv.products ?? (inv as any).productservice ?? [];
        for (const p of items) {
          const variantId =
            typeof p.variantid === "string" ? p.variantid : p.variantid?.id;
          const qty = (p.qty ?? 0) * (p.unitqty ?? 1);
          if (variantId && variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] -= qty;
            totalSalesStockOut += qty;
          }
        }
      }

      // Step 3: Transfer Out quantities
      for (const t of transfers) {
        if (t.status && t.frombranchid === branchId) {
          const variantId =
            typeof t.variantid === "string" ? t.variantid : t.variantid?.id;
          const qty = t.transferqty ?? 0;
          if (variantId && variantStockMap[variantId] !== undefined) {
            variantStockMap[variantId] -= qty;
            totalTransferStockOut += qty;
          }
        }
      }

      // Step 4: Purchase Stock In
      for (const pInvoice of purchaseInvoices) {
        const items = pInvoice.products ?? (pInvoice as any).productservice ?? [];
        for (const p of items) {
          const qty = (p.qty ?? 0) * (p.unitqty ?? 1);
          totalPurchaseStockIn += qty;
        }
      }

      // Step 5: Calculate total current stock
      const totalCurrentStock = Object.values(variantStockMap).reduce(
        (a, b) => a + b,
        0
      );

      return {
        purchaseStockIn: totalPurchaseStockIn,
        salesStockOut: totalSalesStockOut,
        transferStockOut: totalTransferStockOut,
        currentStock: totalCurrentStock,
      };
    }, [products, transfers, invoices, purchaseInvoices, branchId]);

  const doughnutData = {
    labels: ["Purchase Stock In", "Sales Stock Out", "Transfer Stock Out"],
    datasets: [
      {
        data: [purchaseStockIn, salesStockOut, transferStockOut],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",
          "rgba(255, 99, 132, 0.6)",
          "rgba(255, 159, 64, 0.6)",
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 99, 132, 1)",
          "rgba(255, 159, 64, 1)",
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
