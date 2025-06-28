import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Product {
  id?: string;
  branchid?: string;
  currentstock?: number;
}

interface Transfer {
  tobranchid: string;
  frombranchid: string;
  status: boolean;
  productid?: string;
  transferqty?: number;
}

interface InvoiceProduct {
  qty?: number;
}

interface Invoice {
  products: InvoiceProduct[];
}

interface PurchaseInvoice {
  products: InvoiceProduct[];
}

interface Props {
  products: Product[];
  transfers: Transfer[];
  invoices: Invoice[];
  purchaseInvoices: PurchaseInvoice[];
  branchId: string;
}

const StockInOutDoughnutChart: React.FC<Props> = ({
  products,
  transfers,
  invoices,
  purchaseInvoices,
  branchId,
}) => {
  const {
    purchaseStockIn,
    salesStockOut,
    transferStockOut,
    currentStock,
  } = useMemo(() => {
    // ✅ Updated current stock logic
    let currentStock = 0;

    if (!branchId || branchId === "") {
      // Admin: remove stock received from transfer
      currentStock = products.reduce((sum, product) => {
        const transferredOutQty = transfers
          .filter(
            (t) =>
              t.status &&
              t.frombranchid === product.branchid &&
              t.productid === product.id
          )
          .reduce((qty, t) => qty + (t.transferqty ?? 0), 0);

        const netStock = (product.currentstock ?? 0) - transferredOutQty;
        return sum + netStock;
      }, 0);
    } else {
      // Branch: take current stock as is
      currentStock = products.reduce(
        (sum, p) => sum + (p.currentstock ?? 0),
        0
      );
    }

    const transferStockOut = (transfers ?? []).reduce((sum, t) => {
      const isAdmin = !branchId;
      const isMatch = isAdmin || String(t.frombranchid) === branchId;
      return isMatch && t.status ? sum + (t.transferqty ?? 0) : sum;
    }, 0);

    const salesStockOut = invoices.reduce(
      (acc, inv) => acc + inv.products.reduce((s, p) => s + (p.qty ?? 0), 0),
      0
    );

    const purchaseStockIn = purchaseInvoices.reduce(
      (acc, inv) => acc + inv.products.reduce((s, p) => s + (p.qty ?? 0), 0),
      0
    );

    return { purchaseStockIn, salesStockOut, transferStockOut, currentStock };
  }, [products, transfers, invoices, purchaseInvoices, branchId]);

  const doughnutData = {
    labels: ["Purchase Stock In", "Sales Stock Out", "Transfer Stock Out"],
    datasets: [
      {
        data: [purchaseStockIn, salesStockOut, transferStockOut],
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)", // Teal
          "rgba(255, 99, 132, 0.6)", // Red
          "rgba(255, 159, 64, 0.6)", // Orange
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
