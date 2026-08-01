import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  const request = new Request(`${protocol}://${host}/studio`, {
    headers: { cookie: requestHeaders.get("cookie") || "" },
  });
  if (!await currentUser(request)) redirect("/");
  return children;
}
