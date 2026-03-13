import * as Linking from "expo-linking";

const RESET_PASSWORD_PATH = "reset-password";

export function isResetPasswordUrl(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? "";
    const hostname = parsed.hostname ?? "";
    return (
      path.includes(RESET_PASSWORD_PATH) ||
      hostname === RESET_PASSWORD_PATH
    );
  } catch {
    return false;
  }
}

export function parseHashParams(url: string): {
  access_token?: string;
  refresh_token?: string;
  type?: string;
} {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return {};
  const hash = url.slice(hashIndex + 1);
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token") ?? undefined,
    refresh_token: params.get("refresh_token") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

export function hasRecoveryTokens(url: string): boolean {
  const { access_token, refresh_token, type } = parseHashParams(url);
  return type === "recovery" && !!access_token && !!refresh_token;
}
