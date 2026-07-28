import {
  authErrorResponse,
  clearSessionCookie,
  verifySameOrigin,
} from "../../../lib/auth";

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const response = Response.json({ ok: true });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
