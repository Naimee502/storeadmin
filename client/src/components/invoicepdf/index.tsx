import { useCallback } from "react";
import { useAppSelector } from "../../redux/hooks";
import { buildInvoicePdfModel } from "./model";
import type { PdfInvoice, PdfOptions } from "./model";

export type { PdfInvoice, PdfOptions } from "./model";

/**
 * Hand back a function that turns an invoice into a PDF blob.
 *
 * A hook rather than a plain function because the bill needs two things
 * that only live in the React tree — the admin's print settings and
 * whichever company record the current login belongs to. @react-pdf
 * renders outside that tree, so both are read here, while hooks still
 * work, and passed down as data.
 *
 * ── Why the import is dynamic ───────────────────────────────────────────
 * @react-pdf/renderer is around a megabyte. Imported normally it would sit
 * in the main bundle and every user would download it on first load — to
 * pay for a feature most of them use a few times a day, from a button that
 * is never the first thing they press. The import() below puts it in its
 * own chunk, fetched the first time somebody actually shares a bill and
 * cached from then on. App startup is untouched.
 *
 * Generation itself needs no network at all: only the built-in Helvetica
 * is used, so nothing is fetched mid-render.
 */
export const useInvoicePdf = () => {
  const auth = useAppSelector((state) => state.auth);
  const { settings } = useAppSelector((state: any) => state.adminsettings);

  return useCallback(
    async (invoice: PdfInvoice, opts?: PdfOptions): Promise<Blob> => {
      const [{ pdf }, { default: InvoiceDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./document"),
      ]);

      // Same resolution the printed copy uses: the header belongs to the
      // owning Admin, whoever is actually signed in.
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
