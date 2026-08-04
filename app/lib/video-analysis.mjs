function upstreamError(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  if (typeof payload.error === "string") return payload.error;
  return payload.error?.message ?? payload.message ?? fallback;
}

function completionText(payload) {
  if (!payload || typeof payload !== "object") return undefined;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return undefined;
  return content
    .map((item) => item && typeof item === "object" && "text" in item
      ? String(item.text ?? "")
      : "")
    .join("\n")
    .trim();
}

export async function analyzeReferenceVideoWithFallback({
  baseUrl,
  apiKey,
  videoDataUrl,
  userPrompt,
  systemPrompt,
  primaryModel,
  fallbackModel,
  fetchImpl = fetch,
  onFallback = () => {},
}) {
  const analyzeWithModel = async (model) => {
    try {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this reference video. User replacement request: ${userPrompt || "Replace the source product with the uploaded product while preserving the reference structure."}`,
                },
                { type: "video_url", video_url: { url: videoDataUrl } },
              ],
            },
          ],
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: upstreamError(
            payload,
            `参考视频分析失败 (${response.status})`,
          ),
        };
      }
      const storyboard = completionText(payload);
      return storyboard
        ? { ok: true, storyboard }
        : { ok: false, status: 502, error: "参考视频分析没有返回分镜脚本" };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "上游连接失败",
      };
    }
  };

  const primary = await analyzeWithModel(primaryModel);
  if (primary.ok) return primary.storyboard;
  if (primary.status === 401 || primary.status === 403) {
    throw new Error(`参考视频分析认证失败：${primary.error}（${primaryModel}）`);
  }

  onFallback({
    model: primaryModel,
    status: primary.status,
    error: primary.error,
    fallbackModel,
  });
  const fallback = await analyzeWithModel(fallbackModel);
  if (fallback.ok) return fallback.storyboard;
  throw new Error(
    `参考视频分析失败：主模型 ${primaryModel}：${primary.error}；兜底模型 ${fallbackModel}：${fallback.error}`,
  );
}
