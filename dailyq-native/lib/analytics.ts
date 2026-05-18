import { supabase } from "@/src/config/supabase";

export function logEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  void (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const { error } = await supabase.from("analytics_events").insert({
      event_name: eventName,
      properties: properties ?? {},
      user_id: session.user.id,
    });
    if (error) console.warn("[analytics]", eventName, error);
  })();
}
