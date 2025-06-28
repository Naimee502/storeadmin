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
  currentstock?: number;
}

interface Transfer {
  tobranchid: string;
  frombranchid: string;
  status: boolean;
  transferqty?: number;
}

interface InvoiceProduct {
  qty?: number;
}

interface Invoice {
  products: InvoiceProduct[];
}

interface Props {
  products: Product[];
  transfers: Transfer[];
  invoices: Invoice[];
  branchId: string;
}

const StockInOutDoughnutChart: React.FC<Props> = ({
  products,
  transfers,
  invoices,
  branchId,
}) => {
  const { stockIn, salesStockOut, transferStockOut } = useMemo(() => {
    const totalCurrentStock = products.reduce(
      (sum, p) => sum + (p.currentstock ?? 0),
      0
    );

    const stockIn = totalCurrentStock;

    const transferStockOut = transfers
      .filter((t) => t.frombranchid === branchId && t.status)
      .reduce((sum, t) => sum + (t.transferqty ?? 0), 0);

    const salesStockOut = invoices.reduce(
      (acc, inv) => acc + inv.products.reduce((s, p) => s + (p.qty ?? 0), 0),
      0
    );

    return { stockIn, salesStockOut, transferStockOut };
  }, [products, transfers, invoices, branchId]);

  const doughnutData = {
    labels: ["Stock In", "Sales Stock Out", "Transfer Stock Out"],
    datasets: [
      {
        data: [stockIn, salesStockOut, transferStockOut],
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
      <div className="mt-4 text-center text-sm font-medium space-y-1">
        <p>
          Total Stock In: <span className="text-teal-600">{stockIn}</span>
        </p>
        <p>
          Sales Stock Out: <span className="text-red-600">{salesStockOut}</span>
        </p>
        <p>
          Transfer Stock Out: <span className="text-orange-500">{transferStockOut}</span>
        </p>
      </div>
    </div>
  );
};

export default StockInOutDoughnutChart;
