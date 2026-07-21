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
    }
}
