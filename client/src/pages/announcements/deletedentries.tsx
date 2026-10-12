import { useNavigate } from "react-router";
import { useMutation, useQuery } from "@apollo/client";
import HomeLayout from "../../layouts/home";
import DataTable from "../../components/datatable";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showMessage } from "../../redux/slices/message";
import { selectModuleActions } from "../../redux/slices/permissions";
import { formatDateDMY } from "../../utils/helper";
import { GET_DELETED_ANNOUNCEMENTS, RESET_ANNOUNCEMENT } from "../../graphql/queries/announcement";

const DeletedAnnouncements = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "announcements"));
  const { data, loading } = useQuery(GET_DELETED_ANNOUNCEMENTS, { fetchPolicy: "cache-and-network" });
  const [resetMut] = useMutation(RESET_ANNOUNCEMENT, { refetchQueries: ["GetAnnouncements", "GetDeletedAnnouncements"] });

  const rows = (data?.getDeletedAnnouncements || []).map((a: any, i: number) => ({
    ...a,
    seqNo: i + 1,
    sentOn: a.startAt ? formatDateDMY(new Date(a.startAt)) : "-",
    seen: `${a.readcount} / ${a.recipientcount}`,
  }));

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Deleted Announcements"
          columns={[
            { label: "#", key: "seqNo" },
            { label: "Title", key: "title" },
            { label: "Audience", key: "audienceLabel" },
            { label: "Sent By", key: "sendername" },
            { label: "Date", key: "sentOn" },
            { label: "Seen", key: "seen" },
          ]}
          data={rows}
          showView={false}
          showEdit={false}
          showDelete={false}
          showAdd={false}
          showImport={false}
          showExport={false}
          showDeleted={false}
          showReset={actions.canReset}
          onReset={async (row: any) => {
            if (!window.confirm(`Restore "${row.title}"?`)) return;
            try {
              await resetMut({ variables: { id: row.id } });
              dispatch(showMessage({ message: "Announcement restored.", type: "success" }));
              navigate("/announcements");
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to restore.", type: "error" }));
            }
          }}
          entriesOptions={[10, 25, 50]}
          defaultEntriesPerPage={10}
          isLoading={loading && rows.length === 0}
        />
      </div>
    </HomeLayout>
  );
};

export default DeletedAnnouncements;
