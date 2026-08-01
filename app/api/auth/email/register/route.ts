import {
  authErrorResponse,
  createSessionToken,
  registerEmailUser,
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
      name?: string;
      password?: string;
      csrfToken?: string;
    };
    verifyCsrf(request, body.csrfToken);
    const user = await registerEmailUser({
      email: body.email || "",
      name: body.name || "",
      password: body.password || "",
    });
    const sessionUser = await sessionUserById(user.id);
    if (!sessionUser) {
      return Response.json({ error: "注册后无法读取用户信息" }, { status: 500 });
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
    }, { status: 201 });
    setSessionCookie(response, request, await createSessionToken(user.id));
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
