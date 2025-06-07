import React from "react";

interface Product {
  id: string;
  qty?: number;
}

interface Invoice {
  id: string;
  billtype: string;
  billnumber: string;
  status: boolean;
  billdate: string;
  paymenttype: string;
  partyacc: string;
  totalamount: number;
  products: Product[];
}

interface Account {
  id: string;
  name: string;
  mobile: string;
}

interface CustomerData {
  getAccounts: Account[];
}

interface RecentOrdersProps {
  salesInvoiceData: {
    getSalesInvoices: Invoice[];
  };
  customerData: CustomerData; // raw customer data with getAccounts array
}

const RecentOrders: React.FC<RecentOrdersProps> = ({
  salesInvoiceData,
  customerData,
}) => {
  const invoiceList = salesInvoiceData?.getSalesInvoices || [];
  const accountsList = customerData?.getAccounts || [];

  // Convert accountsList array into a Map for quick lookup by id
  const customerMap: Map<string, Account> = React.useMemo(() => {
    const map = new Map<string, Account>();
    accountsList.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accountsList]);

  const tableData = invoiceList.map((invoice, index) => {
    const totalqty = invoice.products.reduce((sum, p) => sum + (p.qty || 0), 0);

    const account = customerMap.get(invoice.partyacc);

    return {
      seqNo: index + 1,
      paymenttype: invoice.paymenttype,
      partyacc: account
        ? `${account.name} - ${account.mobile}`
        : invoice.partyacc,
      totalitem: invoice.products.length,
      totalqty,
      billdate: invoice.billdate,
      billtype_billnumber: `${invoice.billtype}-${invoice.billnumber}`,
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
