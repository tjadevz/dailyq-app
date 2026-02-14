/**
 * Web Push: subscribe/unsubscribe and send subscription to Supabase.
 * Only runs in secure context (HTTPS or localhost).
 */

import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export type PushSubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

function hasPushSupport(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in navigator &&
    "Notification" in globalThis
  );
}

/**
 * Subscribe the current user to push. Requests permission, gets SW registration,
 * subscribes with VAPID key, then upserts into push_subscriptions.
 * Idempotent per user: upsert by user_id avoids duplicates.
 */
export async function subscribeUserToPush(): Promise<void> {
  if (!isSecureContext()) {
    throw new Error("Push requires a secure context (HTTPS or localhost).");
  }
  if (!hasPushSupport()) {
    throw new Error("This browser does not support push notifications.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey?.trim()) {
    throw new Error("VAPID public key is not configured.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const json = subscription.toJSON();
  const keys = json.keys;
  if (!keys?.p256dh || !keys?.auth) {
    throw new Error("Invalid subscription keys.");
  }

  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    throw new Error("You must be signed in to enable notifications.");
  }

  const row: PushSubscriptionRow = {
    user_id: user.id,
    endpoint: json.endpoint ?? "",
    p256dh: keys.p256dh,
    auth: keys.auth,
  };

  const { error: upsertError } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "user_id" });

  if (upsertError) {
    throw new Error(upsertError.message || "Failed to save subscription.");
  }
}

/**
 * Unsubscribe from push: remove browser subscription and delete from DB.
 */
export async function unsubscribeUserFromPush(): Promise<void> {
  if (!isSecureContext() || !hasPushSupport()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Returns whether the current client has an active push subscription.
 */
export async function hasPushSubscription(): Promise<boolean> {
  if (!hasPushSupport()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
