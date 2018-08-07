"use strict";

var http = require("http"),
  url = require("url"),
  querystring = require("querystring");

const { logger } = require("appium-support");
let log = logger.getLogger("TestWa");
var testwaServer = {};

var host =
  process.env.TESTWA_PORTAL_URL || "http://localhost:8008/agent/client";
var port = 8008;
var path = "/attp/client";

testwaServer.SendDataNativeApp = function(replyData, portal = host) {
  let portalURL = url.parse(portal);
  var content = JSON.stringify(replyData);
  var options = {
    host: portalURL.hostname,
    port: portalURL.port,
    path: portalURL.pathname,
    method: "POST",
    header: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": content.length
    }
  };
  // log.debug(options, content);
  var req_testwa = http.request(options, function(res) {
    res.setEncoding("utf8");
    res.on("data", function(data) {
      log.debug(" waHeart beating!");
    });
  });
  req_testwa.on("error", e => {
    console.error(`problem with request: ${e.message}`);
  });
  req_testwa.write(content);
  req_testwa.end();
};

testwaServer.SendDataWebview = function(datas, res) {
  var content = JSON.stringify(datas);
  var options = {
    host: host,
    port: port,
    path: path,
    method: "POST",
    header: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": content.length
    }
  };
  var req_testwa = http.request(options, function(res) {
    res.setEncoding("utf8");
    res.on("data", function(data) {
      log.debug("test webview case is ok!");
    });
  });

  req_testwa.write(content);
  req_testwa.end();
};

module.exports = testwaServer;
