## node_modules\appium\node_modules\appium-base-driver\build\lib\protocol\protocol.js

1. 导入 const testwa = require("../../../../../lib/testwa");
2. asyncHandler 方法的
   if (driver.executeCommand)
   判断之前添加
   testwa.beforeExecuteCommand(driver,req.params.sessionId,spec.command);
3. ~~第二个 if (spec.command === CREATE_SESSION_COMMAND){...结束前添加
   //let arg = driver ? driver.args : args;if (arg.report) {testwa.initBaseDriver(driver)};~~
4. res.status(httpStatus).json(httpResBody)前添加
   let arg = driver ? driver.args : args;if (arg.genTool || arg.portal) {await testwa.handler(driver, req, httpStatus, httpResBody, spec.command, jsonObj)};

## node_modules\appium\node_modules\appium-xcuitest-driver\build\lib\driver.js

1. shouldValidateCaps = true 改为 shouldValidateCaps = false

## node_modules\appium\node_modules\appium-android-driver\build\lib\driver.js

1. shouldValidateCaps = true 改为 shouldValidateCaps = false
2. getJavaVersion 行注释掉

## node_modules\appium\node_modules\appium-uiautomator2-driver\build\lib\driver.js

1. getJavaVersion 行注释掉
