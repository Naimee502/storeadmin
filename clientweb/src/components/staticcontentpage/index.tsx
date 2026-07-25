import Breadcrumb from "../breadcrumb";

// Shared renderer for the About Us / Privacy Policy / Terms & Conditions
// pages — content comes entirely from the admin's Settings → General page
// (via useTenant(), edited there with a rich text editor), so it's real
// HTML, not plain text. Nothing here is static/hardcoded copy.
export default function StaticContentPage({ title, content }: { title: string; content: string }) {
  const hasContent = content.replace(/<[^>]*>/g, "").trim().length > 0;

  return (
    <div>
      <Breadcrumb items={[{ label: title }]} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="mb-6 text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h1>
          {hasContent ? (
            <div
              className="space-y-4 text-sm leading-relaxed text-slate-600 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-brand-600 [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-sm text-slate-400">This business hasn't added {title.toLowerCase()} content yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
