import { useAppSelector } from "../redux/hooks";

/** An opt-in module (Loyalty, Prescriptions) ticked for this business; a blank module list keeps it off. */
export const useOptInOn = (id: string) =>
  useAppSelector((s: any) => {
    const list = s.auth?.admin?.allowedmodules ?? s.auth?.branch?.admin?.allowedmodules ?? s.auth?.staff?.admin?.allowedmodules;
    return Array.isArray(list) && list.some((m: string) => String(m).toLowerCase() === id);
  });
