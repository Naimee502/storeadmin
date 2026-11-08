// Identifies the logged-in user so stored data never crosses logins.
function decodeJwt(token: string): any {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64 + "===".slice((b64.length + 3) % 4))
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function fromPersistedAuth(): string | null {
  try {
    const root = JSON.parse(localStorage.getItem("persist:root") || "null");
    const auth = root?.auth ? JSON.parse(root.auth) : null;
    const type = auth?.type;
    const id = type ? auth?.[type]?.id : null;
    return type && id ? `${type}:${id}` : null;
  } catch {
    return null;
  }
}

// "type:id" of the current login, or null when nobody is logged in.
export function currentUserKey(): string | null {
  try {
    if (localStorage.getItem("isAuthenticated") !== "true") return null;
    const token = localStorage.getItem("accessToken");
    const payload = token ? decodeJwt(token) : null;
    if (payload?.id && payload?.type) return `${payload.type}:${payload.id}`;
    return fromPersistedAuth();
  } catch {
    return null;
  }
}
