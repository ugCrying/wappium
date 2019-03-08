// Requires the admc/wd client library
// (npm install wd)
// Then paste this into a .js file and run with Node 7.6+

let RETRY = 5;
const wd = require('wd');
const driver = wd.promiseChainRemote("http://localhost:4723/wd/hub");
const caps = {"platformName":"Android","automationName":"UiAutomator2","deviceName":"e301970f7d93","udid":"e301970f7d93","appPackage":"io.appium.android.apis","appActivity":"io.appium.android.apis.ApiDemos"};
const fs = require('fs-extra')
const adb = require('adbkit');
const client = adb.createClient();
const request = require('request').defaults({
  timeout: 3000,
  forever: true,
  json: true,
  baseUrl: 'http://localhost:4444/wd/hub/session/1/',
});
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function main () {
  try {
    await driver.init(caps);
  } catch (e) {
    if (!RETRY--) return console.log(e);
    await sleep(2000);
    console.log("wd retry");
    return main().catch(console.log);
  }
  await sleep(10000);
  try{
    let el0 = await driver.elementByAccessibilityId("OS");
  await el0.click();await sleep(3000);
  let el1 = await driver.elementByAccessibilityId("SMS Messaging");
  await el1.click();await sleep(3000);
  }catch(e){
    const date = new Date().getTime();
    request.get('/source', (_err, _res, body) => {
      fs.outputFile(require('path').join(__dirname,'source', caps.udid, date + '.xml'), body&&body.value);
    });
    client
      .screencap(caps.udid)
      .then(adb.util.readAll)
      .then(function(output) {
        fs.outputFile(require('path').join(__dirname,'screen', caps.udid, date + '.png'), output);
      });
    console.log(e);
  }
  await driver.quit();
}
let i=1;
const alive = () => {
  main()
    /*.then(() => {
      setTimeout(() => {
        console.log('第',++i,'次回放')
        alive();
      }, 5000);
    });*/
};
alive();
