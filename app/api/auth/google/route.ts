import {
  authErrorResponse,
  createSessionToken,
  sessionUserById,
  setSessionCookie,
  upsertGoogleUser,
  verifyCsrf,
  verifyGoogleCredential,
  verifySameOrigin,
} from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const body = await request.json() as {
      credential?: string;
      csrfToken?: string;
    };
    verifyCsrf(request, body.csrfToken);
    if (!body.credential) {
      return Response.json({ error: "缺少 Google 登录凭证" }, { status: 400 });
    }
    const user = await upsertGoogleUser(
      await verifyGoogleCredential(body.credential),
    );
    const sessionUser = await sessionUserById(user.id);
    if (!sessionUser) {
      return Response.json({ error: "登录后无法读取用户信息" }, { status: 500 });
    }
    const response = Response.json({
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        pictureUrl: sessionUser.pictureUrl,
      },
      hasApiKey: sessionUser.hasApiKey,
      keyLastFour: sessionUser.keyLastFour,
    });
    setSessionCookie(response, request, await createSessionToken(user.id));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
