import ExpoModulesCore
import WidgetKit

/// Bridges WidgetCenter to JS so the app can know whether the DailyQ
/// home-screen widget is actually placed, instead of guessing from usage.
public class DailyqWidgetStatusModule: Module {
    private let widgetKind = "DailyQWidget"

    public func definition() -> ModuleDefinition {
        Name("DailyqWidgetStatus")

        AsyncFunction("isInstalled") { (promise: Promise) in
            WidgetCenter.shared.getCurrentConfigurations { result in
                switch result {
                case .success(let widgets):
                    let installed = widgets.contains { $0.kind == self.widgetKind }
                    promise.resolve(installed)
                case .failure:
                    promise.resolve(false)
                }
            }
        }

        // Forces the widget to refetch today's question now, instead of waiting for
        // its own once-a-day schedule — called on app open so a widget stuck on the
        // "open DailyQ" fallback (e.g. after a failed overnight refresh) recovers
        // immediately rather than staying stale until the next scheduled reload.
        Function("reload") {
            WidgetCenter.shared.reloadTimelines(ofKind: self.widgetKind)
        }
    }
}
