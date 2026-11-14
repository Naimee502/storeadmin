import { Prescription } from "../../../models/service";
import { resolveTenant, TenantError } from "../../../utils/tenant";
import { clinicDoctors, myRx, myRxShape, rxPrintToken } from "../../../utils/clinic";

const me = async (context: any) => {
  if (context?.user?.type !== "party" || !context.user.id) throw new TenantError("Please sign in.", "UNAUTHENTICATED");
  const scope = await resolveTenant(context);
  return { partyid: context.user.id, adminid: scope.adminid };
};

export const clinicResolvers = {
  Query: {
    getClinicDoctors: async (_: any, { adminid }: any, context: any) => {
      const scope = await resolveTenant(context, { requestedAdminId: adminid });
      return clinicDoctors(scope.adminid);
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
