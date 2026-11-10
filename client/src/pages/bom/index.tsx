import { useNavigate } from "react-router";
import DataTable from "../../components/datatable";
import HomeLayout from "../../layouts/home";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectModuleActions } from "../../redux/slices/permissions";
import { showMessage } from "../../redux/slices/message";
import { useProductServicesQuery } from "../../graphql/hooks/products";
import { useServerPaging, useServerTable } from "../../hooks/useservertable";
import { useOfflineList } from "../../offline/listing";
import { useBomsPageQuery, useManufacturingMutations } from "../../graphql/hooks/manufacturing";
import { lineCost, toMfgLines } from "../../components/mfglines";
import { formatDateDMY } from "../../utils/helper";

export const money = (n: any) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const itemName = (d: any) => `${d?.productserviceid?.name || ""}${d?.variantid?.name ? ` - ${d.variantid.name}` : ""}`;

/** Estimated cost of one run: material at purchase rate + operations + overhead. */
export const bomRunCost = (b: any, products: any[]) => {
  const material = toMfgLines(b.items).reduce((s, l, i) => s + lineCost(products, l) * (1 + Number(b.items?.[i]?.wastage || 0) / 100), 0);
  const labour = (b.operations || []).reduce((s: number, o: any) => s + (Number(o.minutes || 0) / 60) * Number(o.costperhour || 0), 0);
  const byValue = (b.byproducts || []).reduce((s: number, l: any) => s + Number(l.rate || 0) * Number(l.qty || 0), 0);
  return { material, labour, overhead: Number(b.overhead || 0), byValue, total: material + labour + Number(b.overhead || 0) - byValue };
};

const Boms = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const actions = useAppSelector((s) => selectModuleActions(s, "bom"));
  const table = useServerTable("bom", ["item", "name", "makes", "updated"]);
  const { items, total, loading, refetch } = useBomsPageQuery(table.variables);
  const serverPaging = useServerPaging(table, total, loading);
  const offline = useOfflineList("bom", table.page);
  const { data: productData } = useProductServicesQuery();
  const products = productData?.getProductServices || [];
  const { deleteBom } = useManufacturingMutations();

  const columns = [
    { label: "S.No", key: "seqNo" },
    { label: "Item", key: "item" },
    { label: "BOM Name", key: "name" },
    { label: "Makes", key: "makes" },
    { label: "Components", key: "components" },
    { label: "Est. Cost / Unit", key: "cost" },
    { label: "Default", key: "isdefaultText" },
    { label: "Updated", key: "updated" },
  ];

  const buildRow = (b: any, i: number) => {
    const c = bomRunCost(b, products);
    return {
      id: b.id,
      seqNo: i >= 0 ? table.offset + i + 1 : "",
      item: itemName(b),
      name: b.name || "—",
      makes: `${b.qty} ${b.salesunitid?.unitname || ""}`,
      components: (b.items || []).length,
      cost: `₹${money(c.total / (Number(b.qty) || 1))}`,
      isdefaultText: b.isdefault ? "Yes" : "—",
      updated: formatDateDMY(b.updatedAt),
      raw: b,
    };
  };
  const serverRows = items.map((b: any, i: number) => offline.decorate(buildRow(b, i), "seqNo"));
  const rows = offline.rows.length ? [...offline.rows.map((b: any) => offline.decorate(buildRow(b, -1), "seqNo")), ...serverRows] : serverRows;

  return (
    <HomeLayout>
      <div className="w-full px-2 sm:px-6 pt-4 pb-6">
        <DataTable
          title="Bill of Materials"
          columns={columns}
          data={rows}
          serverPaging={serverPaging}
          showAdd={actions.showAdd}
          showEdit={actions.showEdit}
          showDelete={actions.showDelete}
          showDeleted={actions.showDelete || actions.canReset}
          showView={false}
          showImport={false}
          showExport={false}
          onAdd={() => navigate("/bom/addedit")}
          onEdit={(row) => navigate(`/bom/addedit/${row.id}`)}
          onDelete={async (row) => {
            if (!window.confirm(`Delete the BOM of ${row.item}?`)) return;
            try {
              await deleteBom({ variables: { id: row.id, expectedUpdatedAt: row.raw?.updatedAt } });
              await refetch();
              dispatch(showMessage({ message: "BOM deleted.", type: "success" }));
            } catch (e: any) {
              dispatch(showMessage({ message: e?.message || "Failed to delete.", type: "error" }));
            }
          }}
          onShowDeleted={() => navigate("/bom/deletedentries")}
          isLoading={loading}
        />
      </div>
    </HomeLayout>
  );
};

export default Boms;
