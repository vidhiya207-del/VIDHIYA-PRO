// Server-only: send FCM push messages via HTTP v1 API using service account JWT auth.
import { SignJWT, importPKCS8 } from "jose";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not set");
  const parsed = JSON.parse(raw) as ServiceAccount;
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = loadServiceAccount();
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return { token: cachedAccessToken.token, projectId: sa.project_id };
  }
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(sa.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const resp = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!resp.ok) throw new Error(`Google token exchange failed [${resp.status}]: ${await resp.text()}`);
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return { token: data.access_token, projectId: sa.project_id };
}

export async function sendFCMToToken(token: string, title: string, body: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const { token: accessToken, projectId } = await getAccessToken();
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            notification: { title, body, icon: "/favicon.ico" },
            fcm_options: { link: "/dashboard" },
          },
        },
      }),
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, status: resp.status, error: text };
  }
  return { ok: true, status: resp.status };
}
