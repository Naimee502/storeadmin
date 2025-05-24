import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { deleteBranch } from "../../redux/slices/branches";

const Branches = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const branchList = useAppSelector((state) => state.branches.branches);

    const columns = [
        { label: "Seq Number", key: "seqNo" },
        { label: "Branch Code", key: "branchcode" },
        { label: "Name", key: "name" },
        { label: "Email", key: "email" },
        { label: "Mobile Number", key: "mobile" },
        { label: "Location", key: "location" },
        { label: "Address", key: "address" },
        { label: "Status", key: "status" },
    ];

    const tableData = branchList.map((branch, index) => ({
    ...branch,
    seqNo: index + 1,
    name: branch.branchname,
    status: branch.status ? "Active" : "Inactive",
    }));

    return (
        <HomeLayout>
            <div className="w-full px-2 sm:px-6 pt-4 pb-6">
                <DataTable
                    title="Branch List"
                    columns={columns}
                    data={tableData}
                    showView={true}
                    showEdit={true}
                    showDelete={true}
                    showImport={true}
                    showExport={true}
                    showAdd={true}
                    onView={() => console.log("View button clicked")}
                    onEdit={(row) => navigate(`/branches/addedit/${row.id}`)}
                    onDelete={(row) => {
                        if (window.confirm(`Are you sure you want to delete branch ${row.branchname}?`)) {
                          dispatch(deleteBranch(row.id));
                        }
                    }}
                    onImport={() => console.log("Import button clicked")}
                    onExport={() => console.log("Export button clicked")}
                    onAdd={() => navigate("/branches/addedit")}
                    entriesOptions={[5, 10, 25, 50]}
                    defaultEntriesPerPage={10}
                />
            </div>
        </HomeLayout>
    );
}
export default Branches;