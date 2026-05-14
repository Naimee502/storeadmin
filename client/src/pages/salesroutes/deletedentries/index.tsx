import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import HomeLayout from "../../../layouts/home";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import {
  useDeletedSalesRoutesQuery,
  useResetSalesRoute,
} from "../../../graphql/hooks/salesroutes";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { showMessage } from "../../../redux/slices/message";
import { showLoading, hideLoading } from "../../../redux/slices/loader";

const DAY_SHORT: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
  fri: "Fri", sat: "Sat", sun: "Sun",
};

const DeletedSalesRoutes: React.FC = () => {
  const navigate = useNavigate();
  const actions = useAppSelector(state => selectModuleActions(state, "salesroutes"));
  const dispatch = useAppDispatch();
  const { admin, branch, type } = useAppSelector((state: any) => state.auth);
  const selectedBranchId = useAppSelector(
    (state: any) => state.selectedBranch.branchId
  );

  const adminId  = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchId = selectedBranchId || branch?.id;

  const filter = { adminId, branchId };

  const { data, loading, refetch } = useDeletedSalesRoutesQuery(filter);
  const { resetSalesRoute }        = useResetSalesRoute();
  const isLoading = useAppSelector((state: any) => state.loader.isLoading);

  useEffect(() => {
    const fetchData = async () => {
      dispatch(showLoading());
      try {
        await refetch();
      } catch (error) {
        console.error("Error fetching deleted sales routes:", error);
      } finally {
        dispatch(hideLoading());
      }
    };
    fetchData();
  }, [dispatch, refetch]);

  const routes = data?.getSalesRoutes || [];

  const columns = [
    { label: "Code",     key: "routecode" },
    { label: "Route Name", key: "routename" },
    { label: "Salesman", key: "salesman" },
    { label: "Visit Days", key: "visitdays" },
    { label: "Parties",  key: "accounts" },
    { label: "Status",   key: "status" },
  ];

  const tableData = routes.map((item: any) => ({
    ...item,
    routecode: item.routecode || "—",
    salesman: item.salesmanid
      ? `${item.salesmanid.name} (${item.salesmanid.staffcode})`
      : "—",
    visitdays: item.visitdays?.length
      ? item.visitdays.map((d: string) => DAY_SHORT[d] || d.toUpperCase()).join(", ")
      : "—",
    accounts: item.accounts
      ? `${item.accounts.length} ${item.accounts.length === 1 ? "Party" : "Parties"}`
      : "0 Parties",
    status: item.status ? "Active" : "Inactive",
  }));

  const handleReset = async (row: any) => {
    if (!window.confirm(`Are you sure you want to restore route "${row.routename}"?`)) return;
    dispatch(showLoading());
    try {
      await resetSalesRoute({ variables: { id: row.id } });
      await refetch();
      dispatch(showMessage({ message: "Sales route restored successfully!", type: "success" }));
      navigate("/salesroutes");
    } catch (error: any) {
      dispatch(showMessage({ message: error.message || "Failed to restore route.", type: "error" }));
    } finally {
      dispatch(hideLoading());
    }
  };

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-10">
        <DataTable
          {...actions}
          title="Deleted Sales Routes"
          columns={columns}
          data={tableData}
          showView={false}
          showEdit={false}
          showDelete={false}
          
          showDeleted={false}
          showImport={false}
          showExport={false}
          showAdd={false}
          onReset={(row) => handleReset(row)}
          entriesOptions={[5, 10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={isLoading || loading}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedSalesRoutes;
