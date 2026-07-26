import WidgetKit

/// No user configuration, so a plain TimelineProvider (not
/// AppIntentTimelineProvider) is enough. Fetches from Supabase itself on
/// every timeline refresh, independent of whether the app is running.
struct DailyQProvider: TimelineProvider {
    private static let placeholderText = "What made you smile today?"

    func placeholder(in context: Context) -> DailyQEntry {
        DailyQEntry(date: Date(), questionText: Self.placeholderText)
    }

    func getSnapshot(in context: Context, completion: @escaping (DailyQEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task {
            let result = await QuestionService.fetchTodayQuestionText()
            completion(DailyQEntry(date: Date(), questionText: result.text))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyQEntry>) -> Void) {
        Task {
            let result = await QuestionService.fetchTodayQuestionText()
            let entry = DailyQEntry(date: Date(), questionText: result.text)

            let reloadDate: Date
            if result.success {
                // Content only changes once a day (matches the app's own
                // day-key semantics), so a single reload at next local midnight
                // is enough — well within WidgetKit's daily refresh budget.
                let now = Date()
                reloadDate = Calendar.current.nextDate(
                    after: now,
                    matching: DateComponents(hour: 0, minute: 0, second: 0),
                    matchingPolicy: .nextTime
                ) ?? now.addingTimeInterval(60 * 60 * 24)
            } else {
                // Fetch failed even after QuestionService's own retry (e.g. no
                // network at all right now) — try again soon instead of
                // leaving the fallback text on screen until next midnight.
                reloadDate = Date().addingTimeInterval(15 * 60)
            }

            completion(Timeline(entries: [entry], policy: .after(reloadDate)))
        }
    }
}
