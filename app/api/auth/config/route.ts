import { createCsrfToken, googleClientId, setCsrfCookie } from "../../../lib/auth";

export async function GET(request: Request) {
  const csrfToken = createCsrfToken();
  const response = Response.json({
    configured: Boolean(googleClientId()),
    clientId: googleClientId(),
    csrfToken,
  });
  setCsrfCookie(response, request, csrfToken);
  return response;
}
