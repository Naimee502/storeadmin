import React, { useEffect, useState } from "react";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useParams, useNavigate } from "react-router";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { useSalesInvoiceByIDQuery, useSalesInvoiceMutations } from "../../../graphql/hooks/salesinvoice";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import FormSwitch from "../../../components/formswitch";
import { useSalesmenQuery } from "../../../graphql/hooks/salesmenaccount";
import { useUnitsQuery } from "../../../graphql/hooks/units";

const AddEditSalesInvoice = () => {
  const { id } = useParams<{ id?: string }>();
  console.log("ID", id)
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addSalesInvoiceMutation, editSalesInvoiceMutation } = useSalesInvoiceMutations();

  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminId = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : undefined;
  const branchId = useAppSelector((state) => state.selectedBranch.branchId);

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
  const [isService, setIsService] = useState(false);
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

  const { data: salesmenAccountData } = useSalesmenQuery();
  const salesmenList = salesmenAccountData?.getSalesmenAccounts || [];
  const salesmendAccountOptions = salesmenList.map((salesmenacc: any) => ({
    value: salesmenacc.id,
    label: `${salesmenacc.name} - ${salesmenacc.mobile}`,
  }));
  // Fetch invoice if editing
  const { data } = useSalesInvoiceByIDQuery(id || "");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Party Accounts
  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const accountOptions = accountsList.map((acc: any) => ({
    value: acc.id,
    label: `${acc.name} - ${acc.mobile}`,
  }));

  // Product List
  const { data:producData, refetch } = useProductServicesQuery();
  const salesProductData = producData?.getProductServices ?? [];
  console.log("Sales Product Data:", JSON.stringify(salesProductData));

  const { data: unitData } = useUnitsQuery();
  const unitsList = unitData?.getUnits || [];

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
        const nextBillNumber = (parseInt(lastBillNumber || "0", 10) + 1)
          .toString()
          .padStart(6, "0");
        setBillNumber(nextBillNumber);
      } else {
        setBillNumber("000001");
      }
    } else if (data?.getSalesInvoiceById) {
      // ✅ EDIT MODE
      const invoice = data.getSalesInvoiceById;

      // --- Invoice header fields
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
      setIsService(invoice.isservice ?? false);

      // --- Invoice product lines
      const mappedProducts = mapInvoiceProducts(
        invoice.productservice || [],
        salesProductData,
        unitsList,
        true
      );

      setProducts(mappedProducts);
    }
  }, [isEdit, data, salesInvoices, salesProductData, unitsList]);

  const mapInvoiceProducts = (
    products: any[],
    productData: any[],
    unitsList: any[],
    isSales: boolean
  ): InvoiceProduct[] => {
    return products.map((p: any) => {
      const productOption = productData.find(
        (prod: any) =>
          prod?.id === p.productserviceid ||
          (p.variantid && prod?.id?.endsWith(p.variantid))
      );

      const variant = productOption?.productvariants?.find(
        (v: any) => v.id === p.variantid
      );

      const productName = `${productOption?.name || ""}${
        variant?.name ? ` - ${variant.name}` : ""
      }${variant?.currentstock !== undefined ? ` - ${variant.currentstock}` : ""}`;

      const unitOptions =
        variant?.pricing?.flatMap((price: any) =>
          price.unitprices.map((up: any) => {
            const unit = unitsList.find((u) => u.id === up.unitid);
            return {
              value: `${up.unitid}--${up.quantity}`,
              label: `${up.quantity} ${unit?.unitname || "Unit"}`,
              unitid: up.unitid,
              quantity: up.quantity,
              salesrate: up.salesrate,
              offerprice: up.offerprice,
              discount: up.discount,
            };
          })
        ) || [];

      const selectedUnit = unitOptions.find(
        (uo: any) => uo.unitid === p[isSales ? "salesunitid" : "purchaseunitid"]
      );

      return {
        productserviceid: p.productserviceid,
        variantid: p.variantid,
        [isSales ? "salesunitid" : "purchaseunitid"]:
          p[isSales ? "salesunitid" : "purchaseunitid"] || null,
        productname: productName,
        unitquantity: p.unitqty,
        quantity: p.qty,
        rate: p.rate,
        total: p.amount,
        discount: p.discount || 0,
        gst: p.gst || 0,
        salesaccountid: p.salesaccountid ?? productOption?.salesaccountid ?? null,
        purchaseaccountid:
          p.purchaseaccountid ?? productOption?.purchaseaccountid ?? null,
        serviceaccountid:
          p.serviceaccountid ?? productOption?.serviceaccountid ?? null,
        [isSales ? "salesUnits" : "purchaseUnits"]: unitOptions,
        selectedUnitValue: selectedUnit ? selectedUnit.value : null, // 👈 key fix
      };
    });
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

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!paymentType) newErrors.paymentType = "Payment type is required";
    if (!partyAccount) newErrors.partyAccount = "Party account is required";
    if (!taxOrSupplyType) newErrors.taxOrSupplyType = "Tax/Supply type is required";
    if (!billDate) newErrors.billDate = "Bill date is required";
    if (!billType) newErrors.billType = "Bill type is required";
    if (!billNumber) newErrors.billNumber = "Bill number is required";
    if (!invoiceType) newErrors.invoiceType = "Invoice type is required";
    if (!salesmenAccount) newErrors.salesmenAccount = "Salesmen account is required";
    if (!products || products.length === 0) newErrors.products = "At least one product is required";

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    if (products.length === 0) {
      alert("Please add at least one product/service");
      return;
    }

    const input = {
      branchid: branchId,
      adminid: adminId,
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
      isservice: isService,
      productservice: products.map((p) => ({
        productserviceid: p.productserviceid,
        variantid: p.variantid,
        salesunitid: p.salesunitid ?? null,
        unitqty: p.unitquantity ?? 0,
        gst: p.gst ?? 0,
        qty: p.quantity ?? 0,
        rate: p.rate ?? 0,
        amount: p.total ?? 0,
        discount: p.discount ?? 0,
        salesaccountid: p.salesaccountid ?? null,
        purchaseaccountid: p.purchaseaccountid ?? null,
        serviceaccountid: p.serviceaccountid ?? null,
      })),
      status,
    };

    console.log("Input Data:", JSON.stringify(input, null, 2));

    try {
      if (isEdit && id) {
        await editSalesInvoiceMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Invoice updated successfully", type: "success" }));
      } else {
        await addSalesInvoiceMutation({ variables: { input } });
        dispatch(showMessage({ message: "Invoice added successfully", type: "success" }));
      }
      await refetch();
      navigate(-1);
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
                  { value: "bank", label: "Bank" },
                  { value: "upi", label: "UPI" },
                  { value: "card", label: "Card" },
                  { value: "cheque", label: "Cheque" },
                  { value: "other", label: "Other" },
                ]}
                error={errors.paymentType}
                searchable
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
                  error={errors.partyAccount}
                  addable onAddNew={() => navigate("/accounts")}
                />
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
                error={errors.taxOrSupplyType}
                searchable
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
                  { value: "taxInvoice", label: "Tax Invoice" },
                  { value: "billOfSupply", label: "Bill Of Supply" },
                  { value: "creditNote", label: "Credit Note" },
                  { value: "debitNote", label: "Debit Note" },
                ]}
                error={errors.billType}
                searchable
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
                  { value: "retail", label: "Retail" },
                  { value: "wholesale", label: "Wholesale" },
                  { value: "manufacturer", label: "Manufacturer" },
                  { value: "trader", label: "Trader" },
                  { value: "service", label: "Service" },
                  { value: "export", label: "Export" },
                  { value: "other", label: "Other" }
                ]}
                error={errors.invoiceType}
                searchable
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
                  error={errors.salesmenAccount}
                  addable onAddNew={() => navigate("/salesmenaccount")}
                />
              </div>
              <FormField
                label="Notes"
                name="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <FormSwitch
                label="Is Service"
                name="isservice"
                checked={isService}
                onChange={(checked) => setIsService(checked)}
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
            productData={salesProductData}
            accountsList={accountsList}
            unitsList={unitsList}
            partyAccount={partyAccount}
            type="sales"
            navigate={navigate}
            iservice={isService}
          />

          {/* Summary */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Summary</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Products Total" name="productsTotal" onChange={() => ""} type="text" value={productsTotal.toFixed(2)} disabled />
              <FormField label="Total Discount" name="totalDiscount" onChange={() => ""} type="text" value={totalDiscount.toFixed(2)} disabled />
              <FormField label="Tax %" name="taxPercent" type="number" value={taxPercent} onChange={() => ''} disabled />
              <FormField label="Tax Amount" name="taxAmount" onChange={() => ""} type="text" value={taxAmount.toFixed(2)} disabled />
              <FormField label="Grand Total" name="grandTotal" onChange={() => ""} type="text" value={grandTotal.toFixed(2)} disabled />
            </div>
          </fieldset>

          <div className="mt-6 flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
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
