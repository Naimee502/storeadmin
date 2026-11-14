import { Prescription } from "../../../models/service";
import { resolveTenant, TenantError } from "../../../utils/tenant";
import { Types } from "mongoose";
import { ProductService } from "../../../models/products";
import { clinicDoctors, myRx, myRxShape, OWNER, rxPrintToken } from "../../../utils/clinic";

const me = async (context: any) => {
  if (context?.user?.type !== "party" || !context.user.id) throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  const scope = await resolveTenant(context);
  return { partyid: context.user.id, adminid: scope.adminid };
};

export const clinicResolvers = {
  Query: {
    getClinicDoctors: async (_: any, { adminid, serviceid }: any, context: any) => {
      const scope = await resolveTenant(context, { requestedAdminId: adminid });
      const list = await clinicDoctors(scope.adminid);
      if (!serviceid || !Types.ObjectId.isValid(String(serviceid))) return list;
      // A service with its own staff list is done only by those doctors (and the owner).
      const p: any = await ProductService.findOne({ _id: serviceid, adminid: scope.adminid }).select("servicevariants.staffids").lean();
      const ids = new Set((p?.servicevariants || []).flatMap((v: any) => (v.staffids || []).map(String)));
      return ids.size ? list.filter((d: any) => d.id === OWNER || ids.has(d.id)) : list;
    },
    getMyPrescriptions: async (_: any, __: any, context: any) => {
      const m = await me(context);
      const rows = await Prescription.find({ adminid: m.adminid, partyacc: m.partyid, status: true }).sort({ billdate: -1, createdAt: -1 }).limit(200).lean();
      return rows.map(myRxShape);
    },
    getMyPrescription: async (_: any, { id }: any, context: any) => {
      const m = await me(context);
      return myRxShape(await myRx(id, m.partyid, m.adminid));
    },
  },
  Mutation: {
    myPrescriptionPrintLink: async (_: any, { id }: any, context: any) => {
      const m = await me(context);
      await myRx(id, m.partyid, m.adminid);
      return `/print/prescription/${rxPrintToken(id, m.partyid, m.adminid)}`;
    },
  },
};
