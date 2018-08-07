const apkUtilsMethods = require("appium-adb/build/lib/tools/apk-utils");
const { install } = apkUtilsMethods;
apkUtilsMethods.install = async function(apk, options) {
  if (!argv.unlockType) {
    await install.bind(this)(apk, options);
  }
};
const UiAutomator2Server = require("appium-uiautomator2-driver/build/lib/uiautomator2.js");
const android_helpers = require("appium-android-driver/build/lib/android-helpers");
const { main } = require("appium");
const installServerApk = UiAutomator2Server.prototype.installServerApk;
const argv = require("yargs").argv;

UiAutomator2Server.prototype.installServerApk = async function(installTimeout) {
  // if (argv.ignoreUiAutomator2) {
  const isInstall = await this.adb.shell([
    "pm",
    "path",
    "io.appium.uiautomator2.server"
  ]);
  if (isInstall) return;
  // }
  await installServerApk.bind(this)(installTimeout);
};

if (require.main === module) {
  main(argv);
}
exports.main = main;
