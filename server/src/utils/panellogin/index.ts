import { ApolloError } from "apollo-server-express";
import { AdminSettings } from "../../models/adminsettings";

const NAMES: Record<string, string> = { branch: "Branch", staff: "Staff" };

/** Business Settings → Login & Signup: may this business's branch or staff sign in to the billing panel? Owner always may. */
export const panelLoginAllowed = async (adminid: any, kind: "admin" | "branch" | "staff") => {
  if (kind === "admin" || !adminid) return true;
  const st: any = await AdminSettings.findOne({ adminid: adminid?._id ?? adminid }).select("loginTabs").lean();
  const tabs: string[] = Array.isArray(st?.loginTabs) ? st.loginTabs : [];
  return !tabs.length || tabs.includes(kind);
};

export const assertPanelLoginAllowed = async (adminid: any, kind: "branch" | "staff") => {
  if (!(await panelLoginAllowed(adminid, kind))) {
    throw new ApolloError(`${NAMES[kind]} login is turned off for this business. Please contact the business owner.`, "LOGIN_TYPE_OFF");
  }
};
