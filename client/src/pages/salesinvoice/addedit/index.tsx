import React, { useEffect, useMemo, useState } from "react";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useParams, useNavigate } from "react-router";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductsQuery } from "../../../graphql/hooks/products";
import { useSalesInvoiceByIDQuery, useSalesInvoiceMutations } from "../../../graphql/hooks/salesinvoice";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import FormSwitch from "../../../components/formswitch";
import { useSalesmenQuery } from "../../../graphql/hooks/salesmenaccount";

const AddEditSalesInvoice = () => {
  const { id } = useParams<{ id?: string }>();
  console.log("ID",id)
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addSalesInvoiceMutation, editSalesInvoiceMutation } = useSalesInvoiceMutations();

  const branchId = localStorage.getItem("branchid") || "";
  const [paymentType, setPaymentType] = useState("");
  const [partyAccount, setPartyAccount] = useState("");
  const [taxOrSupplyType, setTaxOrSupplyType] = useState("");
  const [billDate, setBillDate] = useState(() => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
  });
  const [billType, setBillType] = useState("");
  const [billNumber, setBillNumber] = useState("000001");
  const [salesmenAccount, setSalesmenAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [taxPercent, setTaxPercent] = useState<number | "">("");
  const [status, setStatus] = useState(true);
  const [productsTotal, setProductsTotal] = useState(0.0);
  const [totalDiscount, setTotalDiscount] = useState(0.0);
  const [taxAmount, setTaxAmount] = useState(0.0);
  const [grandTotal, setGrandTotal] = useState(0.0);
  const salesInvoices = useAppSelector(
      (state) => state.salesinvoice.invoices
    );

  // Party Accounts
  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountOptions = accountsList.map((acc: any) => ({
    value: acc.id,
    label: `${acc.name} - ${acc.mobile}`,
  }));
   const { data: salesmenAccountData, refetch: salesmenAccountRefetch } = useSalesmenQuery(branchId);
   const salesmenList = salesmenAccountData?.getSalesmenAccounts || [];
   const salesmendAccountOptions = salesmenList.map((salesmenacc: any) => ({
    value: salesmenacc.id,
    label: `${salesmenacc.name} - ${salesmenacc.mobile}`,
  }));

  // Product List
  const { data: productData, refetch } = useProductsQuery();
  const productsList = useMemo(() => {
    return (productData?.getProducts || []).map((product: any) => ({
      id: product.id,
      name: `${product.name} - ${product.currentstock}`,
      currentstock: product.currentstock,
      barcode: product.barcode
    }));
  }, [productData?.getProducts]);

  // Fetch invoice if editing
  const { data } = useSalesInvoiceByIDQuery(id || "");

  useEffect(() => {
      if (accountData?.getAccounts) {
        accountRefetch();
      }
    }, [accountData, refetch]);

 useEffect(() => {
  if (!isEdit) {
    if (salesInvoices.length > 0) {
        const billNumbers = salesInvoices.map((inv) => inv.billnumber);
        const lastBillNumber = [...billNumbers].sort().pop();
        const nextBillNumber = (
          parseInt(lastBillNumber || "0", 10) + 1
        ).toString().padStart(6, "0");
        setBillNumber(nextBillNumber);
      } else {
        setBillNumber("000001");
      }
  } else if (data?.getSalesInvoice) {
    const invoice = data.getSalesInvoice;

    // Set all main invoice fields
    setSalesmenAccount(invoice.salesmenid || "");
    setPaymentType(invoice.paymenttype || "");
    setPartyAccount(invoice.partyacc || "");
    setTaxOrSupplyType(invoice.taxorsupplytype || "");
    setBillDate(invoice.billdate || "");
    setBillType(invoice.billtype || "");
    setBillNumber(invoice.billnumber || "");
    setNotes(invoice.notes || "");
    setInvoiceType(invoice.invoicetype || "");
    setTaxPercent(invoice.totalgst || 0);
    setStatus(invoice.status ?? true);

    // Map products and set in parent state (with productname)
    const mappedProducts = invoice.products.map((p: any) => ({
      productid: p.id,
      productname: productsList.find((prod: any) => prod.id === p.id)?.name || "",
      quantity: p.qty,
      rate: p.rate,
      total: p.amount,
      discount: p.discount || 0,
      gst: p.gst,
    }));
    setProducts(mappedProducts);
  }
}, [isEdit, data, productsList, salesInvoices]);

  const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTaxPercent(isNaN(value) ? 0 : value);
  };

   const handleProductsChange = (updatedProducts: InvoiceProduct[]) => {
    setProducts(updatedProducts);
  };

  useEffect(() => {
    const productsTotalCalc = products.reduce((sum, p) => sum + p.total, 0);
    const totalDiscountCalc = products.reduce((sum, p) => sum + (p.discount || 0), 0);
    const taxAmountCalc = typeof taxPercent === "number" ? (productsTotalCalc * taxPercent) / 100 : 0;
    const grandTotalCalc = productsTotalCalc + taxAmountCalc - totalDiscountCalc;

    setProductsTotal(productsTotalCalc);
    setTotalDiscount(totalDiscountCalc);
    setTaxAmount(taxAmountCalc);
    setGrandTotal(grandTotalCalc);
  }, [products, taxPercent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (products.length === 0) {
      alert("Please add at least one product");
      return;
    }

    const input = {
      branchid: branchId,
      salesmenid: salesmenAccount,
      paymenttype: paymentType,
      partyacc: partyAccount,
      taxorsupplytype: taxOrSupplyType,
      billdate: billDate,
      billtype: billType,
      billnumber: billNumber,
      notes,
      invoicetype: invoiceType,
      subtotal: productsTotal,
      totaldiscount: totalDiscount,
      totalgst: taxAmount,
      totalamount: grandTotal,
      products: products.map((p) => ({
        id: p.productid,
        qty: p.quantity,
        rate: p.rate,
        gst: p.gst,
        amount: p.total,
        discount: p.discount || 0,
      })),
      status,
    };
    console.log("SalesInvoiceInput:", JSON.stringify(input));

    try {
      if (isEdit && id) {
        await editSalesInvoiceMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Invoice updated successfully", type: "success" }));
      } else {
        await addSalesInvoiceMutation({ variables: { input } });
        dispatch(showMessage({ message: "Invoice added successfully", type: "success" }));
      }
      await refetch();
      navigate("/salesinvoice");
    } catch (error: any) {
      console.error("Error:", error);
      dispatch(showMessage({ message: "An error occurred", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6 text-sm sm:text-base">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">
          {isEdit ? "Edit Sales Invoice" : "Add Sales Invoice"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Details */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Main Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Payment Type"
                name="paymentType"
                type="select"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "debit", label: "Debit" },
                  { value: "online", label: "Online" },
                ]}
              />
              <div className="flex items-end gap-2">
                <FormField
                  label="Party Account (Name - Mobile)"
                  name="partyAccount"
                  type="select"
                  value={partyAccount}
                  onChange={(e) => setPartyAccount(e.target.value)}
                  options={accountOptions}
                  searchable
                />
                <Button type="button" variant="outline" onClick={() => navigate('/accounts')}>
                  +
                </Button>
              </div>
              <FormField
                label="Tax/Supply Type"
                name="taxOrSupplyType"
                type="select"
                value={taxOrSupplyType}
                onChange={(e) => setTaxOrSupplyType(e.target.value)}
                options={[
                  { value: "taxInvoice", label: "Tax Invoice" },
                  { value: "billOfSupply", label: "Bill of Supply" },
                  { value: "other", label: "Other" },
                ]}
              />
              <FormField
                label="Bill Date"
                name="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />
              <FormField
                label="Bill Type"
                name="billType"
                type="select"
                value={billType}
                onChange={(e) => setBillType(e.target.value)}
                options={[
                  { value: "tax", label: "Tax" },
                  { value: "bill", label: "Bill" },
                ]}
              />
              <FormField
                label="Bill Number"
                name="billNumber"
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                disabled={isEdit}
              />
              <FormField
                label="Invoice Type"
                name="invoiceType"
                type="select"
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                options={[
                  { value: "regular", label: "Regular" },
                  { value: "other", label: "Other" },
                ]}
              />
              <div className="flex items-end gap-2">
                <FormField
                  label="Salesmen Account (Name - Mobile)"
                  name="salesmenAccount"
                  type="select"
                  value={salesmenAccount}
                  onChange={(e) => setSalesmenAccount(e.target.value)}
                  options={salesmendAccountOptions}
                  searchable
                />
                <Button type="button" variant="outline" onClick={() => navigate('/salesmenaccount')}>
                  +
                </Button>
              </div>
              <FormField
                label="Notes"
                name="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <FormSwitch
                label="Status"
                name="status"
                checked={status}
                onChange={(checked) => setStatus(checked)}
              />
            </div>
          </fieldset>

          {/* Product Section */}
          <ProductSection
            products={products}
            setProducts={setProducts}
            productsList={productsList || []}
            onProductsChange={handleProductsChange}
            type="sales"
          />

          {/* Summary */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Summary</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Products Total" name="productsTotal" onChange={()=> ""} type="text" value={productsTotal.toFixed(2)} disabled />
              <FormField label="Total Discount" name="totalDiscount" onChange={()=> ""} type="text" value={totalDiscount.toFixed(2)} disabled />
              <FormField
                label="Tax %"
                name="taxPercent"
                type="number"
                value={taxPercent}
                onChange={()=>''}
                disabled
              />
              <FormField label="Tax Amount" name="taxAmount" onChange={()=> ""} type="text" value={taxAmount.toFixed(2)} disabled />
              <FormField label="Grand Total" name="grandTotal" onChange={()=> ""} type="text" value={grandTotal.toFixed(2)} disabled />
            </div>
          </fieldset>

          <div className="mt-6 flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/salesinvoice")}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={products.length === 0}>
              {isEdit ? "Update Invoice" : "Save Invoice"}
            </Button>
          </div>
        </form>
      </div>
    </HomeLayout>
  );
};

export default AddEditSalesInvoice;
