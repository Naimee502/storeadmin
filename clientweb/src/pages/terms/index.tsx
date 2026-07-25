import StaticContentPage from "../../components/staticcontentpage";
import { useTenant } from "../../contexts/tenant";

export default function TermsPage() {
  const { websiteTermsContent } = useTenant();
  return <StaticContentPage title="Terms & Conditions" content={websiteTermsContent} />;
}
