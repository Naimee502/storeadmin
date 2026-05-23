import React, { useEffect, useState, useMemo } from "react";
import FormField from "../../../components/formfiled";
import Button from "../../../components/button";
import ProductSection from "../../../components/productsection";
import type { InvoiceProduct } from "../../../components/productsection";
import HomeLayout from "../../../layouts/home";
import { useParams, useNavigate } from "react-router";
import { useAccountsQuery } from "../../../graphql/hooks/accounts";
import { useProductServicesQuery } from "../../../graphql/hooks/products";
import {
  usePurchaseOrderByIDQuery,
  usePurchaseOrderMutations,
} from "../../../graphql/hooks/purchaseorder";
import { useBranchesQuery } from "../../../graphql/hooks/branches";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import PosAddCustomer from "../../../components/posaddcustomer";

const AddEditPurchaseOrder = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { addPurchaseOrderMutation, editPurchaseOrderMutation } =
    usePurchaseOrderMutations();

  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector(
    (state) => state.selectedBranch.branchId
  );
  const storedBranchId = localStorage.getItem("branchid") || "";
  const storedAdminId = localStorage.getItem("adminid") || "";

  // Fetch branches to auto-detect when staff has no branch assigned
  const { data: branchesData } = useBranchesQuery();
  const firstBranchId = branchesData?.getBranches?.[0]?.id || "";

  const adminId =
    type === "admin"
      ? admin?.id
      : type === "branch"
      ? (branch?.admin?.id || admin?.id || storedAdminId)
      : type === "staff"
      ? (staff?.admin?.id || admin?.id || storedAdminId)
      : (admin?.id || storedAdminId);
  const branchId =
    type === "admin"
      ? (selectedBranchId || firstBranchId)
      : type === "branch"
      ? (branch?.id || selectedBranchId || storedBranchId || firstBranchId)
      : type === "staff"
      ? (staff?.branchid?.id || selectedBranchId || storedBranchId || firstBranchId)
      : (selectedBranchId || storedBranchId || firstBranchId);

  const creatorInfo = useMemo(() => {
    if (type === "admin" && admin)
      return { id: admin.id, name: admin.name, type: "admin" };
    if (type === "branch" && branch)
      return {
        id: branch.id,
        name: branch.branchname || branch.name || "Branch",
        type: "branch",
      };
    if (type === "staff" && staff)
      return { id: staff.id, name: staff.name, type: "staff" };
    return { id: "", name: "Unknown", type: "unknown" };
  }, [type, admin, branch, staff]);

  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const [paymentType, setPaymentType] = useState("");
  const [partyAccount, setPartyAccount] = useState<any>(null);
  const [taxOrSupplyType, setTaxOrSupplyType] = useState("");
  const [billDate, setBillDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [billType, setBillType] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [isService, setIsService] = useState(false);
  const [orderType, setOrderType] = useState("retail");
  const [products, setProducts] = useState<InvoiceProduct[]>([]);
  const [status, setStatus] = useState(true);
  const [productsTotal, setProductsTotal] = useState(0.0);
  const [totalDiscount, setTotalDiscount] = useState(0.0);
  const [taxAmount, setTaxAmount] = useState(0.0);
  const [grandTotal, setGrandTotal] = useState(0.0);

  const [notes, setNotes] = useState("");

  const { data } = usePurchaseOrderByIDQuery(id || "");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const purchaseOrders = useAppSelector(
    (state) => state.purchaseorder.orders
  );

  const { data: accountData, refetch: accountRefetch } = useAccountsQuery();
  // For Purchase Order, the party is a vendor / supplier
  const vendorAccounts =
    accountData?.getAccounts?.filter((acc: any) => acc.type === "vendor") || [];
  const accountOptions = vendorAccounts.map((acc: any) => ({
    value: acc.id,
    label: `${acc.name} - ${acc.mobile}`,
  }));

  const { data: producData } = useProductServicesQuery();
  const purchaseProductData = producData?.getProductServices ?? [];

  useEffect(() => {
    if (isEdit && data?.getPurchaseOrderById) {
      const order = data.getPurchaseOrderById;
      setPaymentType(order.paymenttype || "");
      setPartyAccount({
        id: order.partyacc?.id || "",
        accountname: order.partyacc?.accountname || "",
        mobile: order.partyacc?.mobile || "",
      });
      setTaxOrSupplyType(order.taxorsupplytype || "");
      setBillDate(order.billdate || "");
      setBillType(order.billtype || "");
      setBillNumber(order.billnumber || "");
      setNotes(order.notes || "");
      setOrderType(order.ordertype || "");
      setStatus(order.status ?? true);
      setIsService(order.isservice ?? false);

      const mappedProducts = order.productservice.map((p: any) => ({
        productserviceid: p.productserviceid.id,
        variantid: p.variantid?.id || null,
        purchaseunitid: p.purchaseunitid?.id || null,
        productname: `${p.productserviceid?.name || ""}${
          p.variantid?.name ? ` - ${p.variantid.name}` : ""
        }`,
        unitquantity: p.unitqty,
        quantity: p.qty,
        rate: p.rate,
        total: p.amount,
        discount: p.discount || 0,
        gst: p.gst || 0,
        salesaccountid: p.salesaccountid?.id || null,
        purchaseaccountid: p.purchaseaccountid?.id || null,
        serviceaccountid: p.serviceaccountid?.id || null,
        selectedUnitValue:
          p.purchaseunitid && p.unitqty
            ? `${p.purchaseunitid.id}--${p.unitqty}`
            : null,
      }));
      setProducts(mappedProducts);
    } else if (!isEdit) {
      // --- NEW ORDER MODE - Auto-calculate next bill number
      if (purchaseOrders.length > 0) {
        const billNumbers = purchaseOrders.map((order) => order.billnumber);
        const lastBillNumber = [...billNumbers].sort().pop();
        const nextBillNumber = (parseInt(lastBillNumber || "0", 10) + 1)
          .toString()
          .padStart(6, "0");
        setBillNumber(nextBillNumber);
      } else {
        setBillNumber("000001");
      }
    }
  }, [isEdit, data, purchaseOrders]);

  useEffect(() => {
    let productsTotalCalc = 0;
    let totalLineDiscount = 0;
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
    if (!billDate) newErrors.billDate = "Date is required";
    if (products.length === 0)
      newErrors.products = "At least one product is required";
    return newErrors;
  };

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

    if (!adminId || !branchId) {
      dispatch(showMessage({ message: "Session error: Admin or Branch ID is missing. Please re-login.", type: "error" }));
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
      taxorsupplytype: taxOrSupplyType || "taxInvoice",
      billdate: billDate,
      billtype: billType || "taxInvoice",
      billnumber: billNumber,
      notes,
      ordertype: orderType,
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

    try {
      if (isEdit && id) {
        await editPurchaseOrderMutation({ variables: { id, input } });
        dispatch(
          showMessage({
            message: "Purchase Order updated successfully",
            type: "success",
          })
        );
      } else {
        await addPurchaseOrderMutation({ variables: { input } });
        dispatch(
          showMessage({
            message: "Purchase Order added successfully",
            type: "success",
          })
        );
      }
      navigate(-1);
    } catch (error: any) {
      console.error("Error:", error);
      dispatch(showMessage({ message: "An error occurred", type: "error" }));
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <h2 className="text-xl font-bold mb-6">
          {isEdit ? "Edit Purchase Order" : "Add Purchase Order"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset className="border rounded-xl p-4 space-y-4">
            <legend className="text-sm font-medium px-2">Order Details</legend>
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
              />
              <FormField
                label="Party Account"
                name="partyAccount"
                type="select"
                value={partyAccount?.id || ""}
                onChange={(e) => {
                  const acc = vendorAccounts.find(
                    (a: any) => a.id === e.target.value
                  );
                  setPartyAccount(acc ? { id: acc.id, ...acc } : null);
                }}
                options={accountOptions}
                error={errors.partyAccount}
                addable
                onAddNew={() => setAddVendorOpen(true)}
              />
              <FormField
                label="Order Date"
                name="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                error={errors.billDate}
              />
              <FormField
                label="Order Number"
                name="billNumber"
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="Auto-generated"
                disabled={!isEdit && billNumber !== ""}
              />
            </div>
          </fieldset>

          <ProductSection
            products={products}
            setProducts={setProducts}
            productData={purchaseProductData}
            partyAccount={partyAccount}
            type="purchase"
            navigate={navigate}
            iservice={isService}
          />

          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="outline">
              Save Order
            </Button>
          </div>
        </form>

        <PosAddCustomer
          open={addVendorOpen}
          onClose={() => setAddVendorOpen(false)}
          onCreated={async () => {
            await accountRefetch();
          }}
          mode="vendor"
        />
      </div>
    </HomeLayout>
  );
};

export default AddEditPurchaseOrder;
