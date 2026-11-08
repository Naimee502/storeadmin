import { useCallback } from "react";
import { useAppSelector } from "../../redux/hooks";
import { buildInvoicePdfModel } from "./model";
import type { PdfInvoice, PdfOptions } from "./model";

export type { PdfInvoice, PdfOptions } from "./model";

/** Returns a function that builds an invoice PDF blob; @react-pdf is lazy-loaded. */
export const useInvoicePdf = () => {
  const auth = useAppSelector((state) => state.auth);
  const { settings } = useAppSelector((state: any) => state.adminsettings);

  return useCallback(
    async (invoice: PdfInvoice, opts?: PdfOptions): Promise<Blob> => {
      const [{ pdf }, { default: InvoiceDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./document"),
      ]);

      // Header uses the owning Admin, whoever is signed in.
      const branch: any = auth.branch;
      const adminInfo: any =
        auth.type === "admin"
          ? auth.admin
          : auth.type === "branch"
            ? auth.branch?.admin
            : auth.type === "staff"
              ? (auth as any).staff?.admin
              : null;

      const model = buildInvoicePdfModel(
        invoice,
        settings,
        {
          name: adminInfo?.companyName,
          address: adminInfo?.address || branch?.address,
          city: branch?.city,
          mobile: adminInfo?.mobile || branch?.phone || branch?.mobile,
        },
        opts
      );

      return pdf(<InvoiceDocument model={model} />).toBlob();
    },
    [auth, settings]
  );
};
