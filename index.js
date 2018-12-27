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

forceInstall = async function(androidDriver) {
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
  //unlockType:不安装工具包的标志
  if (!argv.unlockType) {
    const installed = install.apply(this, arguments);
    forceInstall(androidDriver);
    return installed;
  }
};
apkUtilsMethods.startApp = async function() {
  const stdout = await startApp.apply(this, arguments);
  this.appLaunchTotalTime = stdout.match(/TotalTime: (.*)/)[1]
    ? +stdout.match(/TotalTime: (.*)/)[1]
    : "无法获取";
  return stdout;
};
apkUtilsMethods.installFromDevicePath = async function() {
  const installed = installFromDevicePath.apply(this, arguments);
  forceInstall(androidDriver);
  return installed;
};
const UiAutomator2Server = require("appium-uiautomator2-driver/build/lib/uiautomator2.js");
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
};
XCUITestDriver.prototype.installApp = async function() {
  const install = this.opts.device.install;
  this.opts.device.install = async (...args) => {
    const startTime = new Date().getTime();
    await install.apply(this, args);
    this.installAppTime = new Date().getTime() - startTime;
  };
  return installApp.apply(this, arguments);
};
UiAutomator2Server.prototype.installServerApk = async function() {
  (await this.adb.shell(["pm", "path", "io.appium.uiautomator2.server"])) ||
    (await installServerApk.apply(this, arguments));
};

if (require.main === module) {
  main(argv).catch(e => {
    console.error(e.message, "appium 启动失败");
  });
}
exports.main = main;
