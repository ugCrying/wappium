"use strict";

var wd = require("wd");
var driver = wd.promiseChainRemote({
  host: "localhost",
  port: 4723
});

driver
  .init({
    platformName: "Android",
    deviceName: "Android Emulator",
    executionTaskId: "11111",
    // automationName: "UiAutomator2",
    // portal: true,
    app: __dirname + "/ApiDemos-debug.apk" // will be set later
  })
  .elementByAccessibilityId("Graphics")
  .click()
  .elementByAccessibilityId("Arcs")
  .back()
  .elementByAccessibilityId("App")
  .elementsByAndroidUIAutomator("new UiSelector().clickable(true)")
  .elementsByAndroidUIAutomator("new UiSelector().enabled(true)")
  .elementByXPath("//android.widget.TextView[@text='API Demos']")
  .elementByAccessibilityId("Graphics")
  .click()
  .elementByAccessibilityId("Arcs")
  .click()
  .removeApp("io.appium.android.apis.ApiDemos")
  .quit()
  .finally(function() {});
