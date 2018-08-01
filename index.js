const { AppiumDriver } = require("appium/build/lib/appium");
const AndroidDriver = require("appium-android-driver/build/lib/driver");
const {
  METHOD_MAP,
  ALL_COMMANDS
} = require("appium-base-driver/build/lib/protocol/routes");
const {
  commands
} = require("appium-android-driver/build/lib/commands/element");
const methods = require("appium-adb/build/lib/tools/adb-commands");
const apkUtilsMethods = require("appium-adb/build/lib/tools/apk-utils");
const testwa = require("./lib/testwa");
const executeCommand = AppiumDriver.prototype.executeCommand;
const { startAndroidSession, deleteSession } = AndroidDriver.prototype;
const { installFromDevicePath, install } = apkUtilsMethods;
// const utf7 = require('emailjs-utf7');
const { main } = require("appium");
const { sleep, retry, asyncify } = require("asyncbox");
let wd = {};
const inputKeyboardValue = async function(keys) {
  let text = keys;
  if (keys instanceof Array) {
    text = keys.join("");
  }

  // text = utf7.imap.encode(text);

  await this.adb.inputTextM(text);
};
METHOD_MAP["/wd/hub/session/:sessionId/element"] = {
  POST: {
    command: "findElement",
    payloadParams: { required: ["using", "value"], optional: ["mode", "note"] }
  }
};
METHOD_MAP["/wd/hub/session/:sessionId/elements"] = {
  POST: {
    command: "findElements",
    payloadParams: { required: ["using", "value"], optional: ["mode"] }
  }
};
METHOD_MAP["/wd/hub/session/:sessionId/value"] = {
  POST: { command: "  ", payloadParams: { required: ["value"] } }
};
ALL_COMMANDS.push("inputValue");
commands.inputValue = async function(keys) {
  return await inputKeyboardValue(keys);
};
AppiumDriver.prototype.executeCommand = async function(cmd, ...args) {
  wd = this;
  const _startTime = new Date();
  testwa.beforeExecuteCommand(this, cmd, args);
  driverRes = await executeCommand.bind(this)(cmd, ...args);
  if (cmd === "createSession") {
    let arg = this ? this.args : args;
    if (arg.report) {
      testwa.initBaseDriver(this);
    }
  }
  let arg = this ? this.args : args;
  if (arg.genTool || arg.portal) {
    await testwa.handler(
      this,
      { _startTime },
      driverRes.status,
      { status: driverRes.status, value: driverRes },
      cmd,
      args
    );
  }
  return driverRes;
};
AndroidDriver.prototype.startAndroidSession = async function() {
  await startAndroidSession.bind(this)();
  let deviceLogPath = this.caps.deviceLogPath || this.opts.deviceLogPath;
  if (deviceLogPath) {
    log.debug("Testwa device log initiating!");
    this.logcatProcess = testwa.startLogcat(
      this.adb,
      deviceLogPath,
      this.sessionId
    );
  }
};
AndroidDriver.prototype.deleteSession = async function() {
  //clean up testwa injections
  if (this.opts.deviceLogPath) {
    log.debug("Stopping testwa device log stream");
    this.logcatProcess.kill();
  }
  await deleteSession.bind(this)();
};
methods.inputTextM = async function(text) {
  /* jshint ignore:start */
  // need to escape whitespace and ( ) < > | ; & * \ ~ " '
  text = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\</g, "\\<")
    .replace(/\>/g, "\\>")
    .replace(/\|/g, "\\|")
    .replace(/\;/g, "\\;")
    .replace(/\&/g, "\\&")
    .replace(/\-/g, "\\-")
    .replace(/\*/g, "\\*")
    .replace(/\~/g, "\\~")
    .replace(/\"/g, '\\"')
    .replace(/\'/g, "\\'")
    .replace(/ /g, "\\ ");
  /* jshint ignore:end */
  await this.shell(["input", "text", text]);
};
apkUtilsMethods.installFromDevicePath = async function(
  apkPathOnDevice,
  opts = {}
) {
  await Promise.all([
    installFromDevicePath.bind(this)(apkPathOnDevice, opts),
    this.forceInstall()
  ]);
};
apkUtilsMethods.install = async function(apk, replace = true, timeout = 60000) {
  await Promise.all([
    install.bind(this)(apk, replace, timeout),
    this.forceInstall()
  ]);
};

apkUtilsMethods.forceInstall = async function() {
  let func = async function() {
    await sleep(2000);
    let element = await wd.findElOrEls(
      "xpath",
      '//*[@content-desc="Install"]|//*[@text="Install"]',
      false
    );
    element = await wd.findElOrEls(
      "xpath",
      '//*[@content-desc="CONFIRM"]|//*[@text="CONFIRM"]',
      false
    );
    await wd.click(element.ELEMENT);
  };

  retry(8, func);
};

if (require.main === module) {
  asyncify(main);
}
exports.main = main;
