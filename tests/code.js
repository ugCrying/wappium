// Requires the admc/wd client library
// (npm install wd)
// Then paste this into a .js file and run with Node 7.6+

const wd = require("wd");
const driver = wd.promiseChainRemote("http://localhost:4723/wd/hub");
const caps = {
  platformName: "Android",
  automationName: "UiAutomator2",
  deviceName: "0123456789ABCDEF",
  appPackage: "io.appium.android.apis",
  appActivity: "io.appium.android.apis.ApiDemos"
};
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
  await driver.init(caps);
  let el0 = await driver.elementByAccessibilityId("Accessibility");
  await el0.click();
  let el1 = await driver.elementByAccessibilityId(
    "Accessibility Node Querying"
  );
  await el1.click();
  await driver.quit();
}

main().catch(console.log);
