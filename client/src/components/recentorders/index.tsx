import React from "react";

// Product inside invoice
interface ProductServiceItem {
  qty?: number;
  amount?: number;
  rate?: number;
  discount?: number;
  unitqty?: number;
  productserviceid?: { id: string; name: string };
  variantid?: { id: string; name: string };
}

interface PartyAccount {
  id: string;
  accountname: string;
  mobile: string;
}

interface Invoice {
  id: string;
  billtype: string;
  billnumber: string;
  status: boolean;
  billdate: string;
  paymenttype: string;
  partyacc: PartyAccount;
  totalamount: number;
  productservice?: ProductServiceItem[];
}

interface CustomerData {
  getAccounts?: PartyAccount[];
}

interface RecentOrdersProps {
  salesInvoiceData?: { getSalesInvoices?: Invoice[] };
  customerData?: CustomerData;
}

const RecentOrders: React.FC<RecentOrdersProps> = ({ salesInvoiceData }) => {
  const invoiceList: Invoice[] = salesInvoiceData?.getSalesInvoices || [];

  const capitalizeFirst = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const tableData = invoiceList.map((invoice, index) => {
    const products = invoice.productservice || [];
    const totalqty = products.reduce((sum, p) => sum + (p.qty ?? 0), 0);

    const party = invoice.partyacc;

    return {
      seqNo: index + 1,
      paymenttype: capitalizeFirst(invoice.paymenttype),
      partyacc: `${party?.accountname ?? "N/A"} - ${party?.mobile ?? "N/A"}`,
      totalitem: products.length,
      totalqty,
      billdate: invoice.billdate,
      billtype_billnumber: `${capitalizeFirst(String(invoice.billtype))}-${invoice.billnumber}`,
      totalamount: invoice.totalamount,
      status: invoice.status ? "Active" : "Inactive",
      id: invoice.id,
    };
  });

  return (
    <div className="bg-white p-4 rounded-xl shadow mt-6">
      <h2 className="text-md font-semibold mb-4">🧾 Recent Orders (Latest 10)</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-100">
            <tr>
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Payment Type</th>
              <th className="py-2 px-3">Party A/c</th>
              <th className="py-2 px-3">Total Items</th>
              <th className="py-2 px-3">Total Qty</th>
              <th className="py-2 px-3">Billing Date</th>
              <th className="py-2 px-3">Billing No</th>
              <th className="py-2 px-3">Total Amount</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tableData.slice(-10).reverse().map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3">{row.seqNo}</td>
                <td className="py-2 px-3">{row.paymenttype}</td>
                <td className="py-2 px-3">{row.partyacc}</td>
                <td className="py-2 px-3">{row.totalitem}</td>
                <td className="py-2 px-3">{row.totalqty}</td>
                <td className="py-2 px-3">{row.billdate}</td>
                <td className="py-2 px-3">{row.billtype_billnumber}</td>
                <td className="py-2 px-3">₹{row.totalamount.toFixed(2)}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      row.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
