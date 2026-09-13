export function makeOpenClawClient({ baseUrl, token, agentId = "main", model = "openclaw" }) {
  if (!baseUrl) throw new Error("OPENCLAW_BASE_URL is required");
  if (!token) throw new Error("OPENCLAW_TOKEN is required");

  const url = baseUrl.replace(/\/$/, "");

  return {
    async chat({ messages, temperature = 0.2, max_tokens = 4000, user = undefined }) {
      const res = await fetch(`${url}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-openclaw-agent-id": agentId,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens,
          user,
          messages,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenClaw gateway error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error("No content returned from model");
      return content;
    },
  };
}
