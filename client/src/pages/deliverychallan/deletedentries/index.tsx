import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks";
import { selectModuleActions } from "../../../redux/slices/permissions";
import DataTable from "../../../components/datatable";
import HomeLayout from "../../../layouts/home";
import { showMessage } from "../../../redux/slices/message";
import { useDeletedDeliveryChallansQuery, useDeliveryChallanMutations } from "../../../graphql/hooks/deliverychallan";
import { formatDateDMY } from "../../../utils/helper";
import { partyLabel } from "../../../utils/partylabel";
import { challanNo, reasonLabel } from "..";

const DeletedDeliveryChallans = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "deliverychallan"));
  const { data, refetch } = useDeletedDeliveryChallansQuery();
  const { resetDeliveryChallanMutation } = useDeliveryChallanMutations();

  const rows = (data?.getDeletedDeliveryChallans || []).map((c: any, i: number) => ({
    ...c,
    seqNo: i + 1,
    billnumber: challanNo(c),
    billdate: formatDateDMY(c.billdate),
    partyacc: partyLabel(c.partyacc) || "N/A",
    reason: reasonLabel(c.reason),
    createdByDisplay: c.createdby_name || "N/A",
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Delivery Challans"
          columns={[
            { label: "Seq", key: "seqNo" },
            { label: "Challan No", key: "billnumber" },
            { label: "Date", key: "billdate" },
            { label: "Party", key: "partyacc" },
            { label: "Reason", key: "reason" },
            { label: "Value", key: "totalamount" },
            { label: "Created By", key: "createdByDisplay" },
          ]}
          data={rows}
          showAdd={false}
          showEdit={false}
          showDelete={false}
          showView={false}
          showImport={false}
          showExport={false}
          showReset={actions.canReset}
          showDeleted={false}
          onReset={async (row) => {
            if (!window.confirm(`Restore ${row.billnumber}? Its stock goes out again.`)) return;
            try {
              await resetDeliveryChallanMutation({ variables: { id: row.id } });
              await refetch();
              dispatch(showMessage({ message: "Restored.", type: "success" }));
              navigate("/deliverychallan");
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Restore failed.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/deliverychallan")}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedDeliveryChallans;
