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
            let text = await QuestionService.fetchTodayQuestionText()
            completion(DailyQEntry(date: Date(), questionText: text))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DailyQEntry>) -> Void) {
        Task {
            let text = await QuestionService.fetchTodayQuestionText()
            let entry = DailyQEntry(date: Date(), questionText: text)

            // Content only changes once a day (matches the app's own
            // day-key semantics), so a single reload at next local midnight
            // is enough — well within WidgetKit's daily refresh budget.
            let now = Date()
            let nextMidnight = Calendar.current.nextDate(
                after: now,
                matching: DateComponents(hour: 0, minute: 0, second: 0),
                matchingPolicy: .nextTime
            ) ?? now.addingTimeInterval(60 * 60 * 24)

            completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
        }
    }
}
