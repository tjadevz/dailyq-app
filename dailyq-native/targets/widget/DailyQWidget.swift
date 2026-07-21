import WidgetKit
import SwiftUI

struct DailyQWidget: Widget {
    let kind: String = "DailyQWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DailyQProvider()) { entry in
            DailyQuestionView(entry: entry)
        }
        .configurationDisplayName("DailyQ")
        .description("Shows today's question.")
        .supportedFamilies([.systemMedium])
    }
}
