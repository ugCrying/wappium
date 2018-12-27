const { main } = require(".");
// process.env.unlockType = true;
const arv = {
  // port: 4723, // 监听的端口	--port 4723
  // callbackAddress: null, // 回调IP地址 (默认: 相同的IP地址)	--callback-address 127.0.0.1
  // callbackPort: null, // 回调端口号 (默认: 相同的端口号)	--callback-port 4723
  // log: null, // 将日志输出到指定文件	--log /path/to/appium.log
  // loglevel: "debug", // 日志级别; 默认 (console[:file]): debug[:debug]	--log-level debug
  // logTimestamp: false, // 在终端输出里显示时间戳
  // localTimezone: false, // 使用本地时间戳
  // relaxedSecurityEnabled: false, // 安全检查
  // webhook: null, // 同时发送日志到 HTTP 监听器	--webhook localhost:9876
  unlockType: true,
  noPermsCheck: true,
  logHandler: (_, msg) => {
    // 日志监听方法
    process.send(msg);
  }
};
main(arv, true).catch(e => {
  console.error(e.message, "appium 启动失败");
});
process.on("message", ({ type }) => {
  switch (type) {
    case "exit":
      process.exit(1);
      break;
  }
});
