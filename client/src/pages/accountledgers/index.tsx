import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import {
  useAccountLedgersQuery,
  useAccountLedgerMutations,
} from "../../graphql/hooks/accountledgers";
import { useAccountGroupsQuery } from "../../graphql/hooks/accountgroups";
import { showLoading, hideLoading } from "../../redux/slices/loader";
import { showMessage } from "../../redux/slices/message";
import { addAccountLedgers } from "../../redux/slices/accountledgers";
import { selectModuleActions } from "../../redux/slices/permissions";

const AccountLedgers = () => {
  const actions = useAppSelector(state => selectModuleActions(state, "accountledgers"));
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminId = admin?.id;

  const { data, refetch } = useAccountLedgersQuery();
  const { data: accountGroupsData } = useAccountGroupsQuery();

  const {
    addAccountLedgerMutation,
    editAccountLedgerMutation,
    deleteAccountLedgerMutation,
  } = useAccountLedgerMutations();

  const ledgerList = data?.getAccountLedgers || [];
  console.log("Ledger List:", JSON.stringify(ledgerList));
  const accountGroupList = accountGroupsData?.getAccountGroups || [];

  const isLoading = useAppSelector((state) => state.loader.isLoading);

  const [formValues, setFormValues] = useState({
    ledgername: "",
    accountgroupid: "",
    ledgertype: "",
    openingbalance: 0,
    openingbalancetype: "debit",
    status: true, // ✅ boolean only always
  });

  const [formErrors, setFormErrors] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleFormChange = (name: string, value: any) => {
    if (name === "openingbalance") value = Number(value);

    if (name === "status") {
      value = value === "true" || value === true; // ✅ convert select value to boolean
    }

    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formValues.ledgername.trim()) errors.ledgername = "Ledger name is required";
    if (!formValues.accountgroupid) errors.accountgroupid = "Account group is required";
    if (!formValues.ledgertype) errors.ledgertype = "Ledger type is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ✅ While editing convert API string ("Active") → boolean
  const handleEdit = (row: any) => {
    setFormValues({
      ledgername: row.ledgername,
      accountgroupid: row.accountgroupid?._id || row.accountgroupid?.id || "",
      ledgertype: row.ledgertype,
      openingbalance: Number(row.openingbalance) || 0,
      openingbalancetype: row.openingbalancetype || "debit",
      status:
        row.status === true ||
        row.status === "Active" ||
        row.status === "true"
    });

    setIsEditing(true);
    setEditingId(row._id || row.id);
  };

  useEffect(() => {
    const fetchAndDispatch = async () => {
      dispatch(showLoading());
      try {
        const { data } = await refetch();
        if (data?.getAccountLedgers) {
          dispatch(addAccountLedgers(data.getAccountLedgers));
        }
      } catch (error) {
        console.error("Error fetching account ledgers:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchAndDispatch();
  }, [dispatch, refetch]);

  const handleFormSubmit = async () => {
    if (!validateForm()) return;
    dispatch(showLoading());

    try {
      const input = {
        ...formValues,
        admin: adminId,
        openingbalance: Number(formValues.openingbalance),
        status: formValues.status === true, 
      };

      if (isEditing && editingId) {
        await editAccountLedgerMutation({
          variables: { id: editingId, input },
        });
        dispatch(showMessage({ message: "Ledger updated successfully.", type: "success" }));
      } else {
        await addAccountLedgerMutation({ variables: { input } });
        dispatch(showMessage({ message: "Ledger added successfully.", type: "success" }));
      }

      await refetch();
      resetForm();
    } catch (error: any) {
      dispatch(showMessage({ message: error.message || "Failed to save ledger.", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  const resetForm = () => {
    setFormValues({
      ledgername: "",
      accountgroupid: "",
      ledgertype: "",
      openingbalance: 0,
      openingbalancetype: "debit",
      status: true,
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const columns = [
    { label: "Seq", key: "seqNo" },
    { label: "Ledger Code", key: "ledgercode" },
    { label: "Ledger Name", key: "ledgername" },
    { label: "Group", key: "groupName" },
    { label: "Type", key: "ledgertype" },
    { label: "Opening", key: "openingbalance" },
    { label: "Balance Type", key: "openingbalancetype" },
    { label: "Status", key: "status" },
  ];

  const tableData = [...ledgerList].reverse().map((l: any, index: number) => ({
    ...l,
    seqNo: index + 1,
    groupName: l.accountgroupid?.accountgroupname || "-",
    status: l.status ? "Active" : "Inactive",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Manage Account Ledgers"
          columns={columns}
          data={tableData}
          {...actions}
          // Inline form replaces the Add button here.
          showAdd={false}
          showView={false}
          onEdit={handleEdit}
          onDelete={async (row) => {
            if (window.confirm(`Delete ledger "${row.ledgername}"?`)) {
              await deleteAccountLedgerMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Ledger deleted.", type: "success" }));
            }
          }}
          onShowDeleted={() => navigate("/accountledgers/deletedentries")}
          entriesOptions={[5, 10, 25]}
          defaultEntriesPerPage={10}
          isLoading={isLoading}
          formFields={[
            { name: "ledgername", label: "Ledger Name", type: "text" },
            {
              name: "accountgroupid",
              label: "Account Group",
              type: "select",
              options: accountGroupList.map((g: any) => ({
                label: g.accountgroupname,
                value: g.id,
              })),
            },
            {
              name: "ledgertype",
              label: "Ledger Type",
              type: "select",
              options: [
                { label: "Customer", value: "customer" },
                { label: "Supplier", value: "vendor" },
                { label: "Bank", value: "bank" },
                { label: "Cash", value: "cash" },
                { label: "Expense", value: "expense" },
                { label: "Income", value: "income" },
                { label: "Other", value: "other" },
              ],
            },
            { name: "openingbalance", label: "Opening Balance", type: "number" },
            {
              name: "openingbalancetype",
              label: "Balance Type",
              type: "select",
              options: [
                { label: "Debit", value: "debit" },
                { label: "Credit", value: "credit" },
              ],
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" },
              ],
            },
          ]}
          formValues={formValues}
          formErrors={formErrors}
          onFormChange={handleFormChange}
          onFormSubmit={handleFormSubmit}
        />
      </div>
    </HomeLayout>
  );
};

export default AccountLedgers;
