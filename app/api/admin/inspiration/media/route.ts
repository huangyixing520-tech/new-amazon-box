import { authErrorResponse, requireAdmin, verifySameOrigin } from "../../../../lib/auth";
import { storeInspirationImage } from "../../../../lib/inspiration-media";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || (kind !== "result" && kind !== "input")) {
      return Response.json({ error: "上传信息不完整" }, { status: 400 });
    }
    return Response.json({ url: await storeInspirationImage(file, kind) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
