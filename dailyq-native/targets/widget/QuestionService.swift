import Foundation
import os.log

/// Fetches "today's question" directly from Supabase, independent of whether
/// the main DailyQ app is running. Mirrors the query pattern used by
/// src/hooks/useTodayQuestion.ts in the RN app (same table/column names),
/// but a widget extension can't read the app's JS/.env, so the public
/// Supabase URL + anon key (already shipped in the app bundle) are inlined
/// here instead.
enum QuestionService {
    private static let supabaseURL = "https://sfxarvxtouzrhkuwcofu.supabase.co"
    private static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmeGFydnh0b3V6cmhrdXdjb2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzM1NTksImV4cCI6MjA4NjIwOTU1OX0.QJEY4eZ81uaxFmIUKKv2gm_eGKSkCaGZeSHAvcSgnPA"

    private static let logger = OSLog(subsystem: "com.tjade.dailyq.widget", category: "QuestionService")

    private static let fallbackNL = "Open DailyQ voor de vraag van vandaag."
    private static let fallbackEN = "Open DailyQ for today's question."

    /// Mirrors getDeviceDefaultLanguage()/mapLocaleToLanguage() in src/i18n/translations.ts:
    /// first preferred locale, "nl" if it starts with "nl", else "en".
    static func resolvedLanguage() -> String {
        let tag = Locale.preferredLanguages.first?.lowercased() ?? ""
        return tag.hasPrefix("nl") ? "nl" : "en"
    }

    /// Mirrors getLocalDayKey() in src/lib/date.ts: local (device) timezone,
    /// NOT UTC, formatted as YYYY-MM-DD.
    static func todayLocalDayKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    static func fetchTodayQuestionText() async -> String {
        let lang = resolvedLanguage()
        let dayKey = todayLocalDayKey()
        let fallback = lang == "nl" ? fallbackNL : fallbackEN

        let path: String
        let dateColumn: String
        let textKey: String
        if lang == "nl" {
            path = "/rest/v1/questions"
            dateColumn = "day"
            textKey = "text"
        } else {
            path = "/rest/v1/daily_questions_en"
            dateColumn = "question_date"
            textKey = "question_text"
        }

        var components = URLComponents(string: supabaseURL + path)!
        components.queryItems = [
            URLQueryItem(name: dateColumn, value: "eq.\(dayKey)"),
            URLQueryItem(name: "select", value: "id,\(textKey),\(dateColumn)"),
        ]

        guard let url = components.url else {
            os_log("Failed to build Supabase URL", log: logger, type: .error)
            return fallback
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                os_log("Supabase returned status %d", log: logger, type: .error, httpResponse.statusCode)
                return fallback
            }
            guard
                let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                let first = rows.first,
                let text = first[textKey] as? String,
                !text.isEmpty
            else {
                os_log("Supabase returned no question row for %{public}@", log: logger, type: .info, dayKey)
                return fallback
            }
            return text
        } catch {
            os_log("Supabase fetch failed: %{public}@", log: logger, type: .error, error.localizedDescription)
            return fallback
        }
    }
}
