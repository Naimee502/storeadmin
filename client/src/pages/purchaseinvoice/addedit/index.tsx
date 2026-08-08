import React, { useEffect, useState, useMemo } from "react";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import OtherChargesSection, { type OtherCharge } from "../../../components/othercharges";
import HomeLayout from "../../../layouts/home";
import { useParams, useNavigate, useLocation } from "react-router";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import { usePurchaseInvoiceByIDQuery, usePurchaseInvoiceMutations, usePurchaseInvoicesQuery } from "../../../graphql/hooks/purchaseinvoice";
import { getLastPartyDocRows } from "../../../utils/helper";
import { usePurchaseOrderByIDQuery, usePurchaseOrderMutations } from "../../../graphql/hooks/purchaseorder";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import FormSwitch from "../../../components/formswitch";
import PosAddCustomer from "../../../components/posaddcustomer";

const AddEditPurchaseInvoice = () => {
  const { id } = useParams<{ id?: string }>();
  console.log("Purchase Invoice ID:", id);
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

  const creatorInfo = useMemo(() => {
    if (type === 'admin' && admin) return { id: admin.id, name: admin.name, type: 'admin' };
    if (type === 'branch' && branch) return { id: branch.id, name: branch.branchname || branch.name || 'Branch', type: 'branch' };
    if (type === 'staff' && staff) return { id: staff.id, name: staff.name, type: 'staff' };
    return { id: '', name: 'Unknown', type: 'unknown' };
  }, [type, admin, branch, staff]);

  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const purchaseInvoiceFormPermissions = useAppSelector(state => state.permissions.permissions?.formPermissions?.purchaseinvoice || {});
  const isFieldEnabled = (fieldId: string) => {
    return purchaseInvoiceFormPermissions[fieldId] !== false;
  };

  const [paymentType, setPaymentType] = useState("");
  const [partyAccount, setPartyAccount] = useState<any>(null);
  const [taxOrSupplyType, setTaxOrSupplyType] = useState("");
  const [billDate, setBillDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [billType, setBillType] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [isService, setIsService] = useState(false);
  const [invoiceType, setInvoiceType] = useState("retail");
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [taxPercent, setTaxPercent] = useState<number | "">("");
  const [status, setStatus] = useState(true);
  const [productsTotal, setProductsTotal] = useState(0.0);
  const [totalDiscount, setTotalDiscount] = useState(0.0);
  const [taxAmount, setTaxAmount] = useState(0.0);
  const [grandTotal, setGrandTotal] = useState(0.0);
  const purchaseInvoices = useAppSelector(
    (state) => state.purchaseinvoice.invoices
  );

  const [otherCharges, setOtherCharges] = useState<OtherCharge[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [transportName, setTransportName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [distance, setDistance] = useState<number | "">("");
  const [roundOff, setRoundOff] = useState<number | "">("");
  const [invoiceDiscount, setInvoiceDiscount] = useState<number | "">("");
  const [invoiceDiscountType, setInvoiceDiscountType] = useState("amount");

  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Fetch invoice if editing
  const { data } = usePurchaseInvoiceByIDQuery(id || "");
  // Fetch order if converting
  const { data: orderData } = usePurchaseOrderByIDQuery(orderId || "");

  // Vendor Accounts
  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  const accountsList = accountData?.getAccounts || [];
  const vendorAccounts = accountsList.filter((acc: any) => acc.type === "vendor");
  console.log("Vendor Account Data:", JSON.stringify(vendorAccounts));
  const accountOptions = vendorAccounts.map((acc: any) => ({
    value: acc.id,
    label: `${acc.name} - ${acc.mobile}`,
  }));

  // Vendor's last 5 purchase invoices — powers dropdown history
  const { data: allInvoicesData } = usePurchaseInvoicesQuery();
  const partyBillHistory = useMemo(
    () => getLastPartyDocRows(allInvoicesData?.getPurchaseInvoices || [], partyAccount?.id, id, "INV"),
    [allInvoicesData, partyAccount?.id, id]
  );

  // Product List
  const { data: productData, refetch } = useProductServicesQuery();
  const purchaseProductData = productData?.getProductServices ?? [];
  console.log("Purchase Product Data:", JSON.stringify(purchaseProductData));

  useEffect(() => {
    if (accountData?.getAccounts) {
      accountRefetch();
    }
  }, [accountData, refetch]);

  useEffect(() => {
    if (isEdit && data?.getPurchaseInvoiceById) {
      // --- EDIT MODE
      const invoice = data.getPurchaseInvoiceById;

      // --- Header fields
      setPaymentType(invoice.paymenttype || "");
      setPartyAccount({
        id: invoice.partyacc?.id || "",
        state: invoice.partyacc?.state || "",
        accounttype: invoice.partyacc?.accounttype || "",
        channel: invoice.partyacc?.channel?.id || invoice.partyacc?.channel || "",
        region: invoice.partyacc?.region || "default",
      });
      setTaxOrSupplyType(invoice.taxorsupplytype || "");
      setBillDate(invoice.billdate || "");
      setBillType(invoice.billtype || "");
      setBillNumber(invoice.billnumber || "");
      setNotes(invoice.notes || "");
      setInvoiceType(invoice.invoicetype || "");
      setTaxPercent(invoice.totalgst || 0);
      setStatus(invoice.status ?? true);
      setIsService(invoice.isservice ?? false);

      setOtherCharges(invoice.othercharges?.map((c: any) => ({
        ledgerid: c.ledgerid?.id || "",
        ledgername: c.ledgerid?.ledgername || c.ledgername || "",
        amount: c.amount || 0,
        gstpercent: c.gstpercent || 0,
        gstamount: c.gstamount || 0,
        totalamount: c.totalamount || 0,
        remarks: c.remarks || "",
      })) || []);
      setDeliveryDate(invoice.deliverydate || "");
      setDueDate(invoice.duedate || "");
      setTransportName(invoice.transportname || "");
      setVehicleNumber(invoice.vehiclenumber || "");
      setEwayBillNo(invoice.ewaybillno || "");
      setDistance(invoice.distance || "");
      setRoundOff(invoice.roundoff || "");
      setInvoiceDiscount(invoice.invoicediscount || "");
      setInvoiceDiscountType(invoice.invoicediscounttype || "amount");

      // --- Products
      const mappedProducts = invoice.productservice.map((p: any) => {
        const productName = `${p.productserviceid?.name || ""}${p.variantid?.name ? ` - ${p.variantid.name}` : ""
          }`;

        // Prepare unit options
        const unitOptions = (p.purchaseunitid ? [{
          value: p.purchaseunitid.id,
          label: p.purchaseunitid.unitname || "Unit",
          unitid: p.purchaseunitid.id,
          quantity: p.unitqty,
          rate: p.rate,
          discount: p.discount,
          offerprice: 0,
        }] : []);

        return {
          productserviceid: p.productserviceid.id,
          variantid: p.variantid?.id || null,
          purchaseunitid: p.purchaseunitid?.id || null,
          productname: productName,
          unitquantity: p.unitqty,
          quantity: p.qty,
          rate: p.rate,
          total: p.amount,
          discount: p.discount || 0,
          gst: p.gst || 0,
          salesaccountid: p.salesaccountid?.id || null,
          purchaseaccountid: p.purchaseaccountid?.id || null,
          serviceaccountid: p.serviceaccountid?.id || null,
          purchaseUnits: unitOptions,
          selectedUnitValue: p.purchaseunitid && p.unitqty ? `${p.purchaseunitid.id}--${p.unitqty}` : null,
        };
      });

      setProducts(mappedProducts);
    } else if (orderData?.getPurchaseOrderById) {
      // --- CONVERT FROM PURCHASE ORDER MODE
      const order = orderData.getPurchaseOrderById;
      setPaymentType(order.paymenttype || "");
      setPartyAccount({
        id: order.partyacc?.id || "",
        state: order.partyacc?.state || "",
        accounttype: order.partyacc?.accounttype || "",
        channel: order.partyacc?.channel?.id || order.partyacc?.channel || "",
        region: order.partyacc?.region || "default",
      });
      setTaxOrSupplyType(order.taxorsupplytype || "");
      setBillDate(order.billdate || "");
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
    } else if (!isEdit && !orderId) {
      // --- NEW INVOICE MODE - Auto-calculate next bill number
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
      const lineDiscount = discount;
      const taxable = (rate - discount) * qty;
      const gstAmount = (taxable * gst) / 100;
      const lineTotal = taxable + gstAmount;

      productsTotalCalc += lineProductTotal;
      totalLineDiscount += lineDiscount;
      taxableSubtotal += taxable;
      totalGSTAmount += gstAmount;
      grandTotalCalc += lineTotal;
    });

    const invDisc = Number(invoiceDiscount) || 0;
    const computedInvDisc = invoiceDiscountType === "percent" ? (taxableSubtotal * invDisc) / 100 : invDisc;

    let otherChargesTotal = 0;
    otherCharges.forEach((c) => {
      otherChargesTotal += c.totalamount;
    });

    const finalGrandTotal = grandTotalCalc - computedInvDisc + otherChargesTotal + (Number(roundOff) || 0);

    setProductsTotal(productsTotalCalc);
    setTotalDiscount(totalLineDiscount + computedInvDisc);
    setTaxAmount(totalGSTAmount);
    setGrandTotal(finalGrandTotal);
  }, [products, otherCharges, roundOff, invoiceDiscount, invoiceDiscountType]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!paymentType) newErrors.paymentType = "Payment type is required";
    if (!partyAccount?.id) newErrors.partyAccount = "Vendor account is required";
    if (!taxOrSupplyType) newErrors.taxOrSupplyType = "Tax/Supply type is required";
    if (!billDate) newErrors.billDate = "Bill date is required";
    if (!billType) newErrors.billType = "Bill type is required";
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
      createdby_id: creatorInfo.id,
      createdby_name: creatorInfo.name,
      createdby_type: creatorInfo.type,
      paymenttype: paymentType,
      partyacc: partyAccount?.id || partyAccount,
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
      othercharges: otherCharges.map(c => ({
        ledgerid: c.ledgerid,
        amount: c.amount,
        gstpercent: c.gstpercent,
        gstamount: c.gstamount,
        totalamount: c.totalamount,
        remarks: c.remarks,
      })),
      deliverydate: deliveryDate || null,
      duedate: dueDate || null,
      transportname: transportName || null,
      vehiclenumber: vehicleNumber || null,
      ewaybillno: ewayBillNo || null,
      distance: distance ? Number(distance) : null,
      roundoff: roundOff ? Number(roundOff) : 0,
      invoicediscount: invoiceDiscount ? Number(invoiceDiscount) : 0,
      invoicediscounttype: invoiceDiscountType,
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

    console.log("Input Data:", JSON.stringify(input, null, 2));

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
            partyacc: partyAccount?.id || partyAccount,
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
            othercharges: input.othercharges,
            deliverydate: input.deliverydate,
            duedate: input.duedate,
            transportname: input.transportname,
            vehiclenumber: input.vehiclenumber,
            ewaybillno: input.ewaybillno,
            distance: input.distance,
            roundoff: input.roundoff,
            invoicediscount: input.invoicediscount,
            invoicediscounttype: input.invoicediscounttype,
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
          {/* ===== Main Details ===== */}
          {(isFieldEnabled("party") || isFieldEnabled("billdate") || isFieldEnabled("billnumber") || isFieldEnabled("paymenttype") || isFieldEnabled("placeofsupply") || isFieldEnabled("billtype") || isFieldEnabled("notes") || isFieldEnabled("status")) && (
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
                  { value: "credit", label: "Credit" },
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
                  label="Vendor Account (Name - Mobile)"
                  name="partyAccount"
                  type="select"
                  value={partyAccount?.id || ""}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const acc = vendorAccounts.find(a => a.id === selectedId);

                    if (acc) {
                      setPartyAccount({
                        id: acc.id,
                        state: acc.state,
                        accounttype: acc.accounttype,
                        channel: acc.channel?.id || acc.channel || "",
                        region: acc.region || "default",
                      });
                    }
                  }}
                  options={accountOptions}
                  searchable
                  error={errors.partyAccount}
                  addable
                  onAddNew={() => setAddVendorOpen(true)}
                  historyTitle={partyAccount?.id ? "Last 5 Bills of this Vendor" : "Vendor Bill History"}
                  historyHeaders={["Bill No", "Date", "Qty", "Disc (₹)", "Total (₹)"]}
                  historyRows={partyBillHistory}
                  historyEmptyText={
                    partyAccount?.id
                      ? "No previous bills — this is their first invoice."
                      : "Select a vendor first to see their bill history."
                  }
                />
              </div>
              {isFieldEnabled("placeofsupply") && <FormField
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
              />}
              {isFieldEnabled("billdate") && <FormField
                label="Bill Date"
                name="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
              />}
              {isFieldEnabled("billnumber") && <FormField
                label="Bill Number"
                name="billNumber"
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="Auto-generated"
                disabled={!isEdit && billNumber !== ""}
              />}
              {isFieldEnabled("billtype") && <FormField
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
              />}
              {isFieldEnabled("notes") && <FormField
                label="Notes"
                name="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />}
              {isFieldEnabled("status") && (
                <div className="flex flex-col">
                  <FormSwitch
                    label="Status"
                    name="status"
                    checked={status}
                    onChange={(checked) => setStatus(checked)}
                  />
                </div>
              )}
            </div>
          </fieldset>
          )}

          {/* ===== SECTION 2: Product Section ===== */}
          <ProductSection
            products={products}
            setProducts={setProducts}
            productData={purchaseProductData}
            invoiceHistory={allInvoicesData?.getPurchaseInvoices || []}
            partyAccount={partyAccount?.id || partyAccount}
            type="purchase"
            navigate={navigate}
          />

          {/* ===== Add Vendor Modal ===== */}
          <PosAddCustomer
            open={addVendorOpen}
            onClose={() => setAddVendorOpen(false)}
            onCreated={async (newId) => {
              await accountRefetch();
              setErrors((prev) => ({ ...prev, partyAccount: undefined }));
              setPartyAccount({ id: newId });
            }}
            mode="vendor"
          />

          {/* ===== SECTION 3: Transport & Delivery ===== */}
          {(isFieldEnabled("deliverydate") || isFieldEnabled("duedate") || isFieldEnabled("transportname") || isFieldEnabled("vehiclenumber") || isFieldEnabled("ewaybill") || isFieldEnabled("distance")) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Transport & Delivery</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isFieldEnabled("deliverydate") && <FormField
                label="Delivery Date"
                name="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />}
              {isFieldEnabled("duedate") && <FormField
                label="Due Date"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />}
              {isFieldEnabled("transportname") && <FormField
                label="Transport Name"
                name="transportName"
                type="text"
                placeholder="e.g., ABC Logistics"
                value={transportName}
                onChange={(e) => setTransportName(e.target.value)}
              />}
              {isFieldEnabled("vehiclenumber") && <FormField
                label="Vehicle Number"
                name="vehicleNumber"
                type="text"
                placeholder="e.g., MH-01-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />}
              {isFieldEnabled("ewaybill") && <FormField
                label="E-Way Bill No."
                name="ewayBillNo"
                type="text"
                value={ewayBillNo}
                onChange={(e) => setEwayBillNo(e.target.value)}
              />}
              {isFieldEnabled("distance") && <FormField
                label="Distance (km)"
                name="distance"
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />}
            </div>
          </fieldset>
          )}

          {/* ===== SECTION 4: Other Charges ===== */}
          <OtherChargesSection
            otherCharges={otherCharges}
            setOtherCharges={setOtherCharges}
            type="purchase"
          />

          {/* ===== SECTION 5: Summary (EXACT SAME FORMAT AS SALES INVOICE) ===== */}
          {(isFieldEnabled("productstotal") || isFieldEnabled("totaldiscount") || isFieldEnabled("taxamount") || isFieldEnabled("summary_othercharges") || isFieldEnabled("invoicediscount") || isFieldEnabled("roundoff") || isFieldEnabled("grandtotal")) && (
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Summary</legend>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {isFieldEnabled("productstotal") && <FormField label="Products Total" name="productsTotal" onChange={() => ""} type="text" value={productsTotal.toFixed(2)} disabled />}
              {isFieldEnabled("totaldiscount") && <FormField label="Total Discount" name="totalDiscount" onChange={() => ""} type="text" value={totalDiscount.toFixed(2)} disabled />}
              {isFieldEnabled("taxamount") && <FormField label="Tax Amount" name="taxAmount" onChange={() => ""} type="text" value={taxAmount.toFixed(2)} disabled />}
              {isFieldEnabled("summary_othercharges") && <FormField label="Other Charges" name="otherCharges" onChange={() => ""} type="text" value={otherCharges.reduce((sum, c) => sum + (c.totalamount || 0), 0).toFixed(2)} disabled />}

              {isFieldEnabled("invoicediscount") && <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <FormField
                    label="Invoice Discount"
                    name="invoiceDiscount"
                    onChange={(e) => setInvoiceDiscount(e.target.value)}
                    type="number"
                    value={invoiceDiscount}
                  />
                </div>
                <select
                  className="border rounded p-2 text-sm h-10 mb-1"
                  value={invoiceDiscountType}
                  onChange={(e) => setInvoiceDiscountType(e.target.value)}
                >
                  <option value="amount">₹</option>
                  <option value="percent">%</option>
                </select>
              </div>}

              {isFieldEnabled("roundoff") && <FormField
                label="Round Off"
                name="roundOff"
                onChange={(e) => setRoundOff(e.target.value)}
                type="number"
                value={roundOff}
              />}

              {isFieldEnabled("grandtotal") && <FormField label="Grand Total" name="grandTotal" onChange={() => ""} type="text" value={grandTotal.toFixed(2)} disabled />}
            </div>
          </fieldset>
          )}

          {/* ===== Action Buttons ===== */}
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

export default AddEditPurchaseInvoice;
