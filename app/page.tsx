import { loadLandingContent } from "./lib/landing-content";
import { runtimeBindings } from "./lib/runtime";
import LandingPage from "./landing-page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { DB } = await runtimeBindings();
  const content = await loadLandingContent(DB);
  return <LandingPage content={content} />;
}
