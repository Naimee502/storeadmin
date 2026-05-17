import React, { useEffect, useState } from "react";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useParams, useNavigate, useLocation } from "react-router";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { usePurchaseInvoiceByIDQuery, usePurchaseInvoiceMutations } from "../../../graphql/hooks/purchaseinvoice";
import { usePurchaseOrderByIDQuery, usePurchaseOrderMutations } from "../../../graphql/hooks/purchaseorder";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import FormSwitch from "../../../components/formswitch";
import PosAddCustomer from "../../../components/posaddcustomer";

const AddEditPurchaseInvoice = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addPurchaseInvoiceMutation, editPurchaseInvoiceMutation } = usePurchaseInvoiceMutations();
  const { editPurchaseOrderMutation } = usePurchaseOrderMutations();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const orderId = queryParams.get("orderId");

  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";

  // Fetch branches to auto-detect when staff has no branch assigned
  const { data: branchesData } = useBranchesQuery();
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const adminId = type === 'admin' ? admin?.id
    : type === 'branch' ? (branch?.admin?.id || admin?.id || storedAdminId)
    : type === 'staff' ? (staff?.admin?.id || admin?.id || storedAdminId)
    : (admin?.id || storedAdminId);
  const branchId = type === 'admin' ? (selectedBranchId || firstBranchId)
    : type === 'branch' ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
    : type === 'staff' ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
    : (selectedBranchId || storedBranchId || firstBranchId);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);

  const [paymentType, setPaymentType] = useState("");
  const [partyAccount, setPartyAccount] = useState("");
  const [taxOrSupplyType, setTaxOrSupplyType] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10)); // today date yyyy-mm-dd
  const [billType, setBillType] = useState("");
  const [billNumber, setBillNumber] = useState("000001");
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [taxPercent, setTaxPercent] = useState<number | "">("");
  const [isService, setIsService] = useState(false);
  const [status, setStatus] = useState(true);
  const [productsTotal, setProductsTotal] = useState(0.0);
  const [totalDiscount, setTotalDiscount] = useState(0.0);
  const [taxAmount, setTaxAmount] = useState(0.0);
  const [grandTotal, setGrandTotal] = useState(0.0);
  const purchaseInvoices = useAppSelector(
    (state) => state.purchaseinvoice.invoices
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Party Accounts (suppliers maybe)
  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const vendorAccounts = accountsList.filter((acc: any) => acc.type === "vendor");
  const accountOptions = vendorAccounts.map((acc: any) => ({
    value: acc.id,
    label: `${acc.name} - ${acc.mobile}`,
  }));

  // Fetch invoice if editing
  const { data } = usePurchaseInvoiceByIDQuery(id || "");
  // Fetch purchase order if converting
  const { data: orderData } = usePurchaseOrderByIDQuery(orderId || "");
  console.log('Pucrhase Edit:', JSON.stringify(data))

  const { data: productData, refetch } = useProductServicesQuery();
  const purchaseProductData = productData?.getProductServices ?? [];

  useEffect(() => {
    if (accountData?.getAccounts) {
      accountRefetch();
    }
  }, [accountData, refetch]);

  useEffect(() => {
    if (!isEdit && orderId && orderData?.getPurchaseOrderById) {
      // --- CONVERT FROM PURCHASE ORDER MODE
      const order = orderData.getPurchaseOrderById;
      setPaymentType(order.paymenttype || "");
      setPartyAccount(order.partyacc?.id || "");
      setTaxOrSupplyType(order.taxorsupplytype || "");
      setBillDate(order.billdate || new Date().toISOString().slice(0, 10));
      setBillType(order.billtype || "");
      setInvoiceType(order.ordertype || "retail");
      setNotes(order.notes || "");
      setIsService(order.isservice || false);
      setBillNumber(""); // Allow auto-generate for the new invoice

      const mappedProducts: InvoiceProduct[] = (order.productservice || []).map((p: any) => ({
        productserviceid: p.productserviceid?.id || "",
        variantid: p.variantid?.id || null,
        purchaseunitid: p.purchaseunitid?.id || null,
        productname: `${p.productserviceid?.name || ""}${p.variantid?.name ? ` - ${p.variantid.name}` : ""}`,
        unitquantity: p.unitqty || 1,
        quantity: p.qty || 0,
        rate: p.rate || 0,
        gst: p.gst || 0,
        discount: p.discount || 0,
        total: p.amount || 0,
        salesaccountid: p.salesaccountid?.id || null,
        purchaseaccountid: p.purchaseaccountid?.id || null,
        serviceaccountid: p.serviceaccountid?.id || null,
        selectedUnitValue: p.purchaseunitid && p.unitqty ? `${p.purchaseunitid.id}--${p.unitqty}` : null,
      }));
      setProducts(mappedProducts);
    } else if (!isEdit) {
      // --- NEW INVOICE MODE
      if (purchaseInvoices.length > 0) {
        const billNumbers = purchaseInvoices.map((inv) => inv.billnumber);
        const lastBillNumber = [...billNumbers].sort().pop();
        const nextBillNumber = (parseInt(lastBillNumber || "0", 10) + 1)
          .toString()
          .padStart(6, "0");
        setBillNumber(nextBillNumber);
      } else {
        setBillNumber("000001");
      }
    } else if (data?.getPurchaseInvoiceById) {
      // --- EDIT MODE
      const invoice = data.getPurchaseInvoiceById;

      // --- Invoice header fields
      setPaymentType(invoice.paymenttype || "");
      setPartyAccount(invoice.partyacc?.id || invoice.partyacc || "");
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
      const mappedProducts = invoice.productservice.map((p: any) => {
        const variantName = p.variantid?.name ? ` - ${p.variantid.name}` : "";
        const productName = `${p.productserviceid?.name || ""}${variantName}`;

        // --- Prepare unit options
        const unitOptions = (p.purchaseunitid ? [{
          value: p.purchaseunitid.id,
          label: p.purchaseunitid.unitname || "Unit",
          unitid: p.purchaseunitid.id,
          quantity: p.unitqty ?? 1,
          rate: p.rate ?? 0,
          discount: p.discount ?? 0,
        }] : []);

        return {
          productserviceid: p.productserviceid?.id || p.productserviceid,
          variantid: p.variantid?.id || null,
          purchaseunitid: p.purchaseunitid?.id || null,
          productname: productName,
          unitquantity: p.unitqty ?? 1,
          quantity: p.qty ?? 0,
          rate: p.rate ?? 0,
          total: p.amount ?? 0,
          discount: p.discount ?? 0,
          gst: p.gst ?? 0,
          salesaccountid: p.salesaccountid?.id || null,
          purchaseaccountid: p.purchaseaccountid?.id || null,
          serviceaccountid: p.serviceaccountid?.id || null,
          purchaseUnits: unitOptions,
          selectedUnitValue: p.purchaseunitid && p.unitqty ? `${p.purchaseunitid.id}--${p.unitqty}` : null,
        };
      });

      setProducts(mappedProducts);
    }
  }, [isEdit, data, orderId, orderData, purchaseInvoices]);


  const handleTaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTaxPercent(isNaN(value) ? 0 : value);
  };

  useEffect(() => {
    let productsTotalCalc = 0;
    let totalLineDiscount = 0;
    let taxableSubtotal = 0;
    let totalGSTAmount = 0;
    let grandTotalCalc = 0;

    products.forEach((p) => {
      const qty = Number(p.quantity || 0);
      const rate = Number(p.rate || 0);
      const discount = Number(p.discount || 0);
      const gst = Number(p.gst || 0);

      const lineProductTotal = qty * rate;
      const lineDiscount = discount * qty;
      const taxable = (rate - discount) * qty;
      const gstAmount = (taxable * gst) / 100;
      const lineTotal = taxable + gstAmount;
      productsTotalCalc += lineProductTotal;
      totalLineDiscount += lineDiscount;
      taxableSubtotal += taxable;
      totalGSTAmount += gstAmount;
      grandTotalCalc += lineTotal;
    });

    setProductsTotal(productsTotalCalc);
    setTotalDiscount(totalLineDiscount);
    setTaxAmount(totalGSTAmount);
    setGrandTotal(grandTotalCalc);
  }, [products]);


  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!paymentType) newErrors.paymentType = "Payment type is required";
    if (!partyAccount) newErrors.partyAccount = "Party account is required";
    if (!taxOrSupplyType) newErrors.taxOrSupplyType = "Tax/Supply type is required";
    if (!billDate) newErrors.billDate = "Bill date is required";
    if (!billType) newErrors.billType = "Bill type is required";
    if (!invoiceType) newErrors.invoiceType = "Invoice type is required";
    if (!products || products.length === 0) newErrors.products = "At least one product is required";

    return newErrors;
  };

  /** ✅ Safely convert unit value (string | object | null) → string | null */
  const getUnitId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && "id" in value) return value.id ?? null;
    return null;
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
      alert("Please add at least one product");
      return;
    }

    const input = {
      branchid: branchId,
      adminid: adminId,
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
        purchaseunitid: getUnitId(p.purchaseunitid) ?? null,
        unitqty: p.unitquantity ?? 1,
        gst: p.gst ?? 0,
        qty: p.quantity ?? 0,
        rate: p.rate ?? 0,
        amount: p.total ?? 0,
        discount: p.discount ?? 0,
        salesaccountid: getUnitId(p.salesaccountid) ?? null,
        purchaseaccountid: getUnitId(p.purchaseaccountid) ?? null,
        serviceaccountid: getUnitId(p.serviceaccountid) ?? null,
      })),
      status,
    };
    console.log("PurchaseInvoiceInput:", JSON.stringify(input));

    try {
      if (isEdit && id) {
        await editPurchaseInvoiceMutation({ variables: { id, input } });
        dispatch(showMessage({ message: "Purchase Invoice updated successfully", type: "success" }));
      } else {
        await addPurchaseInvoiceMutation({ variables: { input } });
        if (orderId) {
          // Mark the source Purchase Order as converted
          const orderInput = {
            paymenttype: paymentType,
            partyacc: partyAccount,
            taxorsupplytype: taxOrSupplyType,
            billdate: billDate,
            billtype: billType,
            billnumber: orderData?.getPurchaseOrderById?.billnumber,
            notes,
            ordertype: invoiceType,
            subtotal: productsTotal,
            totaldiscount: totalDiscount,
            totalgst: taxAmount,
            totalamount: grandTotal,
            adminid: adminId,
            branchid: branchId,
            productservice: input.productservice,
            isservice: isService,
            isConverted: true,
            status,
          };
          await editPurchaseOrderMutation({
            variables: { id: orderId, input: orderInput },
          });
        }
        dispatch(showMessage({ message: "Purchase Invoice added successfully", type: "success" }));
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
          {isEdit ? "Edit Purchase Invoice" : "Add Purchase Invoice"}
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
                  addable
                  onAddNew={() => setAddCustomerOpen(true)}
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
              />
              <FormField
                label="Bill Number"
                name="billNumber"
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                disabled={isEdit}
                placeholder="Leave blank for auto-generate"
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
              />
              <FormField
                label="Notes"
                name="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {/* <FormSwitch label="Is Service" name="isservice" checked={isService} onChange={setIsService} /> */}
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
            productData={purchaseProductData}
            partyAccount={partyAccount}
            type="purchase"
            navigate={navigate}
          />

          <PosAddCustomer
            open={addCustomerOpen}
            onClose={() => setAddCustomerOpen(false)}
            onCreated={async (newId) => {
              await accountRefetch();
              setErrors((prev) => ({ ...prev, partyAccount: undefined }));
              setPartyAccount(newId);
            }}
            mode="vendor"
          />

          {/* Summary */}
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Summary</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Products Total" name="productsTotal" onChange={() => ""} type="text" value={productsTotal.toFixed(2)} disabled />
              <FormField label="Total Discount" name="totalDiscount" onChange={() => ""} type="text" value={totalDiscount.toFixed(2)} disabled />
              <FormField label="Tax Amount" name="taxAmount" onChange={() => ""} type="text" value={taxAmount.toFixed(2)} disabled />
              <FormField label="Grand Total" name="grandTotal" onChange={() => ""} type="text" value={grandTotal.toFixed(2)} disabled />
            </div>
          </fieldset>

          <div className="mt-6 flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/purchaseinvoice")}>
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

export default AddEditPurchaseInvoice;
