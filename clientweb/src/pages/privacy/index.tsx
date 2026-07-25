import StaticContentPage from "../../components/staticcontentpage";
import { useTenant } from "../../contexts/tenant";

export default function PrivacyPage() {
  const { websitePrivacyContent } = useTenant();
  return <StaticContentPage title="Privacy Policy" content={websitePrivacyContent} />;
}
