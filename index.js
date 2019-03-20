console.log("##########################################");
console.log(
  `Testwa-Appium based on appium@${
    require("appium/package.json").version
  }！\nStarting...`
);
console.log("JAVA_HOME:", process.env.JAVA_HOME);
console.log("ANDROID_HOME:", process.env.ANDROID_HOME);
console.log("##########################################");
process.env.http_proxy = "";
process.env.https_proxy = "";
const argv = require("yargs").argv;
const apkUtilsMethods = require("appium-adb/build/lib/tools/apk-utils");
const { install, startApp, installFromDevicePath } = apkUtilsMethods;

const xpathLocators = {
  def: {
    en: '//*[@content-desc="Install"]|//*[@text="Install"]',
    zh: '//*[@content-desc="安装"]|//*[@text="安装"]',
    retry: 3
  },
  xiaomi: {
    en: '//*[@content-desc="Install"]|//*[@text="Install"]',
    zh: '//*[@content-desc="继续安装"]|//*[@text="继续安装"]'
  },
  oppo: {
    en: '//*[@content-desc="Install"]|//*[@text="Install"]',
    zh: '//*[@content-desc="安装"]|//*[@text="安装"]',
    retry: 8
  },
  samsung: {
    en: '//*[@content-desc="CONFIRM"]|//*[@text="CONFIRM"]',
    zh: '//*[@content-desc="确定"]|//*[@text="确定"]'
  }
};

const getInstallXpathLocator = function(manufacturer, language) {
  let lan;
  let retry;
  if (manufacturer && xpathLocators.hasOwnProperty(manufacturer)) {
    lan = language
      ? xpathLocators[manufacturer][language]
      : xpathLocators[manufacturer].zh;
    retry = xpathLocators[manufacturer].retry
      ? xpathLocators[manufacturer].retry
      : xpathLocators.def.retry;
    return [lan, retry];
  }
  lan = language ? xpathLocators.def[language] : xpathLocators.def.zh;
  retry = xpathLocators.def.retry;
  return [lan, retry];
};

const forceInstall = async function(androidDriver) {
  console.log("##########################################");
  console.log("testwa:forceInstall");
  console.log("##########################################");
  let manufacturer = androidDriver.caps.deviceManufacturer.toLowerCase();
  let language = androidDriver.caps.language.toLowerCase();
  let [locator, retries] = getInstallXpathLocator(manufacturer, language);
  let func = async function() {
    try {
      await sleep(2000);
      let element = await androidDriver.findElOrEls("xpath", locator, false);
      await androidDriver.click(element.ELEMENT);
    } catch (err) {
      logTestwa.errorAndThrow(err.message);
    }
  };
  retry(retries, func);
};

apkUtilsMethods.install = async function() {
  console.log("##########################################");
  console.log("3.testwa:install");
  console.log("##########################################");
  //unlockType:不安装工具包的标志
  if (!argv.unlockType) {
    console.log("##########################################");
    console.log("4.testwa:apkUtilsMethods.install");
    console.log("##########################################");
    const installed = install.apply(this, arguments);
    // forceInstall(androidDriver);
    return installed;
  }
};
apkUtilsMethods.startApp = async function() {
  const stdout = await startApp.apply(this, arguments);
  this.appLaunchTotalTime = stdout.match(/TotalTime: (.*)/)[1]
    ? +stdout.match(/TotalTime: (.*)/)[1]
    : "无法获取";
  console.log("##########################################");
  console.log("5.testwa:startApp", this.appLaunchTotalTime);
  console.log("##########################################");
  return stdout;
};
apkUtilsMethods.installFromDevicePath = async function() {
  console.log("##########################################");
  console.log("testwa:installFromDevicePath");
  console.log("##########################################");
  const installed = installFromDevicePath.apply(this, arguments);
  // forceInstall(androidDriver);
  return installed;
};
require("appium-android-driver/build/lib/android-helpers.js").default.pushSettingsApp = async function() {};
const {
  UiAutomator2Server
} = require("appium-uiautomator2-driver/build/lib/uiautomator2.js");
// .default;
const {
  XCUITestDriver
} = require("appium-xcuitest-driver/build/lib/driver.js");
const { main } = require("appium");
const installServerApk = UiAutomator2Server.prototype.installServerApk;
const startWdaSession = XCUITestDriver.prototype.startWdaSession;
const installApp = XCUITestDriver.prototype.installApp;
XCUITestDriver.prototype.startWdaSession = async function() {
  const startTime = new Date().getTime();
  await startWdaSession.apply(this, arguments);
  this.startAppTime = new Date().getTime() - startTime;
  console.log("##########################################");
  console.log("testwa:startWdaSession", this.startAppTime);
  console.log("##########################################");
};
XCUITestDriver.prototype.installApp = async function() {
  const install = this.opts.device.install;
  this.opts.device.install = async (...args) => {
    const startTime = new Date().getTime();
    await install.apply(this, args);
    this.installAppTime = new Date().getTime() - startTime;
    console.log("##########################################");
    console.log("testwa:install ios App", this.installAppTime);
    console.log("##########################################");
  };
  return installApp.apply(this, arguments);
};
UiAutomator2Server.prototype.installServerApk = async function() {
  console.log("##########################################");
  console.log("2.testwa:installServerApk");
  console.log("##########################################");
  (await this.adb.shell(["pm", "path", "io.appium.uiautomator2.server"])) ||
    (await installServerApk.apply(this, arguments));
};

if (require.main === module) {
  main(argv).catch(e => {
    console.log("##########################################");
    console.error(e.message, "wappium 启动失败");
    console.log("##########################################");
  });
}
exports.main = main;
