import { currentUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return Response.json({ user: null });
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
    },
    hasApiKey: user.hasApiKey,
    keyLastFour: user.keyLastFour,
  });
}
