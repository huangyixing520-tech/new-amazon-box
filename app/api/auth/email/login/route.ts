import {
  authenticateEmailUser,
  authErrorResponse,
  createSessionToken,
  sessionUserById,
  setSessionCookie,
  verifyCsrf,
  verifySameOrigin,
} from "../../../../lib/auth";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const body = await request.json() as {
      email?: string;
      password?: string;
      csrfToken?: string;
    };
    verifyCsrf(request, body.csrfToken);
    const userId = await authenticateEmailUser(
      body.email || "",
      body.password || "",
    );
    const sessionUser = await sessionUserById(userId);
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
    setSessionCookie(response, request, await createSessionToken(userId));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
