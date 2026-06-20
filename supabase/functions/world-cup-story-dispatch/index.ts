type SupabaseWebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

const GITHUB_API = "https://api.github.com";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function isChangedFinishedResult(payload: SupabaseWebhookPayload) {
  if (String(payload.table || "") !== "matches") return false;
  if (String(payload.type || "").toUpperCase() !== "UPDATE") return false;

  const next = String(payload.record?.status || "").toUpperCase();
  const prev = String(payload.old_record?.status || "").toUpperCase();
  if (next !== "FINISHED") return false;
  if (payload.record?.home_score == null || payload.record?.away_score == null) return false;

  const becameFinished = prev !== "FINISHED";
  const scoreChanged =
    payload.record?.home_score !== payload.old_record?.home_score ||
    payload.record?.away_score !== payload.old_record?.away_score ||
    payload.record?.winner_code !== payload.old_record?.winner_code;

  return Boolean(payload.record?.id || payload.record?.external_id) && (becameFinished || scoreChanged);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const expectedSecret = env("STORY_DISPATCH_SECRET");
  const actualSecret = req.headers.get("x-friendlybet-secret") || "";
  if (actualSecret !== expectedSecret) return json(401, { ok: false, error: "unauthorized" });

  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch (_) {
    return json(400, { ok: false, error: "invalid_json" });
  }

  if (!isChangedFinishedResult(payload)) {
    return json(200, { ok: true, dispatched: false, reason: "not_changed_finished_result" });
  }

  const repo = env("GITHUB_REPO");
  const token = env("GITHUB_DISPATCH_TOKEN");
  const match = payload.record || {};
  const res = await fetch(`${GITHUB_API}/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "friendlybet-story-dispatch",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "world-cup-story-publish",
      client_payload: {
        match_id: match.id || null,
        external_id: match.external_id || null,
        home: match.home_team_code || null,
        away: match.away_team_code || null,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return json(502, { ok: false, error: "github_dispatch_failed", status: res.status, body: text.slice(0, 240) });
  }

  return json(200, { ok: true, dispatched: true });
});
