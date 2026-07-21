/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "DailyQWidget",
  displayName: "DailyQ",
  deploymentTarget: "17.0",
  bundleIdentifier: ".widget",
  icon: "../../assets/images/icon.png",
  frameworks: ["SwiftUI", "WidgetKit"],
});
