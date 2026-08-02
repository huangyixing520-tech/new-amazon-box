import { loadInspirationCases } from "../../lib/inspiration-data";
import { runtimeBindings } from "../../lib/runtime";

export async function GET() {
  const { DB } = await runtimeBindings();
  return Response.json({ cases: await loadInspirationCases(DB) });
}
