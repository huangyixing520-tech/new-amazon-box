import {
  authErrorResponse,
  requireAdmin,
  verifySameOrigin,
} from "../../../lib/auth";
import {
  loadLandingContent,
  saveLandingContent,
} from "../../../lib/landing-content";
import { runtimeBindings } from "../../../lib/runtime";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { DB } = await runtimeBindings();
    return Response.json({ content: await loadLandingContent(DB) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireAdmin(request);
    const { DB } = await runtimeBindings();
    if (!DB) {
      return Response.json(
        { error: "落地页配置数据库尚未就绪" },
        { status: 503 },
      );
    }
    const body = await request.json() as { content?: unknown };
    const content = await saveLandingContent(DB, body.content, user.email);
    return Response.json({ content });
  } catch (error) {
    return authErrorResponse(error);
  }
}
