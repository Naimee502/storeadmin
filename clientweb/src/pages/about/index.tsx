import StaticContentPage from "../../components/staticcontentpage";
import { useTenant } from "../../contexts/tenant";

export default function AboutPage() {
  const { websiteAboutContent } = useTenant();
  return <StaticContentPage title="About Us" content={websiteAboutContent} />;
}
