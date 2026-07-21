import SwiftUI
import WidgetKit

struct DailyQuestionView: View {
    var entry: DailyQEntry

    private let backgroundColor = Color(red: 0.118, green: 0.063, blue: 0.251) // #1E1040
    private let backgroundColorSubtle = Color(red: 0.157, green: 0.090, blue: 0.310) // subtle lighter tint for gradient
    private let labelColor = Color(red: 0.769, green: 0.710, blue: 0.992) // #C4B5FD

    private var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [backgroundColorSubtle, backgroundColor],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("DAILYQ")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2) // ~0.12em of a 10pt font
                .foregroundColor(labelColor)

            Spacer(minLength: 4)

            Text(entry.questionText)
                .font(.custom("Poppins-Regular", size: 22))
                .foregroundColor(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(4)
                .multilineTextAlignment(.leading)

            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { backgroundGradient }
        // Entire widget surface is the tap target — no button/link needed.
        .widgetURL(URL(string: "dailyq://today?openAnswer=1&source=widget"))
    }
}

#Preview(as: .systemMedium) {
    DailyQWidget()
} timeline: {
    DailyQEntry(date: .now, questionText: "What made you smile today?")
    DailyQEntry(
        date: .now,
        questionText: "What is the hardest thing about being in a relationship with you, and how has that changed over the years?"
    )
}
