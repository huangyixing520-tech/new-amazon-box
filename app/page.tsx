import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadLandingContent } from "./lib/landing-content";
import { currentUser } from "./lib/auth";
import { runtimeBindings } from "./lib/runtime";
import LandingPage from "./landing-page";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  const request = new Request(`${protocol}://${host}/`, {
    headers: { cookie: requestHeaders.get("cookie") || "" },
  });
  if (await currentUser(request)) redirect("/studio");
  const { DB } = await runtimeBindings();
  const content = await loadLandingContent(DB);
  return <LandingPage content={content} />;
}
