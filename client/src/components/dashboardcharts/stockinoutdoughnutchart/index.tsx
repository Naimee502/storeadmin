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
  openingstock?: number;
  // other fields if needed
}

interface Transfer {
  tobranchid: string;
  frombranchid: string;
  status: boolean;
  transferqty?: number;
  // other fields if needed
}

interface InvoiceProduct {
  qty?: number;
}

interface Invoice {
  products: InvoiceProduct[];
  // other fields if needed
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
  // Calculate stock in/out based on passed raw data
  const { stockIn, stockOut } = useMemo(() => {
    const totalOpeningStock = products.reduce(
      (sum, p) => sum + (p.openingstock ?? 0),
      0
    );

    const incomingTransfer = transfers
      .filter((t) => t.tobranchid === branchId && t.status)
      .reduce((sum, t) => sum + (t.transferqty ?? 0), 0);

    const outgoingTransfer = transfers
      .filter((t) => t.frombranchid === branchId && t.status)
      .reduce((sum, t) => sum + (t.transferqty ?? 0), 0);

    const stockIn = totalOpeningStock + incomingTransfer;

    const totalSalesQuantity = invoices.reduce(
      (acc, inv) => acc + inv.products.reduce((s, p) => s + (p.qty ?? 0), 0),
      0
    );

    const stockOut = outgoingTransfer + totalSalesQuantity;

    return { stockIn, stockOut };
  }, [products, transfers, invoices, branchId]);

  const doughnutData = {
    labels: ["Stock In", "Stock Out"],
    datasets: [
      {
        data: [stockIn, stockOut],
        backgroundColor: ["rgba(75,192,192,0.6)", "rgba(255,99,132,0.6)"],
        borderColor: ["rgba(75,192,192,1)", "rgba(255,99,132,1)"],
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow">
      <h2 className="text-md font-semibold mb-2">📦 Stock In/Out</h2>
      <Doughnut data={doughnutData} />
      <div className="mt-4 text-center text-sm font-medium">
        <p>
          Total Stock In: <span className="text-blue-600">{stockIn}</span>
        </p>
        <p>
          Total Stock Out: <span className="text-red-600">{stockOut}</span>
        </p>
      </div>
    </div>
  );
};

export default StockInOutDoughnutChart;
