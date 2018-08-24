"use strict";
/*用于替换 
\node_modules\appium\node_modules\appium-base-driver\build\lib\protocol
中同名文件*/
var _classCallCheck = require("babel-runtime/helpers/class-call-check")[
  "default"
];

var _extends = require("babel-runtime/helpers/extends")["default"];

var _toConsumableArray = require("babel-runtime/helpers/to-consumable-array")[
  "default"
];

var _slicedToArray = require("babel-runtime/helpers/sliced-to-array")[
  "default"
];

var _getIterator = require("babel-runtime/core-js/get-iterator")["default"];

var _regeneratorRuntime = require("babel-runtime/regenerator")["default"];

var _interopRequireDefault = require("babel-runtime/helpers/interop-require-default")[
  "default"
];

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

var _appiumSupport = require("appium-support");

var _validators = require("./validators");

var _errors = require("./errors");

var _routes = require("./routes");

var _basedriverHelpers = require("../basedriver/helpers");

var _bluebird = require("bluebird");

var _bluebird2 = _interopRequireDefault(_bluebird);

var _basedriverDriver = require("../basedriver/driver");

var _basedriverDriver2 = _interopRequireDefault(_basedriverDriver);
const testwa = require("../../../../../../../lib/testwa");

var mjsonwpLog = _appiumSupport.logger.getLogger("MJSONWP");
var w3cLog = _appiumSupport.logger.getLogger("W3C");

var JSONWP_SUCCESS_STATUS_CODE = 0;
// TODO: Make this value configurable as a server side capability
var LOG_OBJ_LENGTH = 1024; // MAX LENGTH Logged to file / console

var MJSONWP_ELEMENT_KEY = "ELEMENT";
var W3C_ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
var IMAGE_ELEMENT_PREFIX = "appium-image-element-";

var IMG_EL_BODY_RE = new RegExp(
  '"(' +
    W3C_ELEMENT_KEY +
    "|" +
    MJSONWP_ELEMENT_KEY +
    ')":s*' +
    ('"' + IMAGE_ELEMENT_PREFIX + '[^"]+"')
);
var IMG_EL_URL_RE = new RegExp(
  "/(element|screenshot)" + ("/" + IMAGE_ELEMENT_PREFIX + "[^/]+")
);

var Protocol = function Protocol() {
  _classCallCheck(this, Protocol);
};

function getLogByProtocol(driver) {
  return driver.isW3CProtocol() ? w3cLog : mjsonwpLog;
}

function isSessionCommand(command) {
  return !_lodash2["default"].includes(_routes.NO_SESSION_ID_COMMANDS, command);
}

function wrapParams(paramSets, jsonObj) {
  /* There are commands like performTouch which take a single parameter (primitive type or array).
   * Some drivers choose to pass this parameter as a value (eg. [action1, action2...]) while others to
   * wrap it within an object(eg' {gesture:  [action1, action2...]}), which makes it hard to validate.
   * The wrap option in the spec enforce wrapping before validation, so that all params are wrapped at
   * the time they are validated and later passed to the commands.
   */
  var res = jsonObj;
  if (
    _lodash2["default"].isArray(jsonObj) ||
    !_lodash2["default"].isObject(jsonObj)
  ) {
    res = {};
    res[paramSets.wrap] = jsonObj;
  }
  return res;
}

function unwrapParams(paramSets, jsonObj) {
  /* There are commands like setNetworkConnection which send parameters wrapped inside a key such as
   * "parameters". This function unwraps them (eg. {"parameters": {"type": 1}} becomes {"type": 1}).
   */
  var res = jsonObj;
  if (_lodash2["default"].isObject(jsonObj)) {
    // some clients, like ruby, don't wrap
    if (jsonObj[paramSets.unwrap]) {
      res = jsonObj[paramSets.unwrap];
    }
  }
  return res;
}

function checkParams(paramSets, jsonObj, protocol) {
  var requiredParams = [];
  var optionalParams = [];
  var receivedParams = _lodash2["default"].keys(jsonObj);

  if (paramSets) {
    if (paramSets.required) {
      // we might have an array of parameters,
      // or an array of arrays of parameters, so standardize
      if (
        !_lodash2["default"].isArray(
          _lodash2["default"].first(paramSets.required)
        )
      ) {
        requiredParams = [paramSets.required];
      } else {
        requiredParams = paramSets.required;
      }
    }
    // optional parameters are just an array
    if (paramSets.optional) {
      optionalParams = paramSets.optional;
    }

    // If a function was provided as the 'validate' key, it will here be called with
    // jsonObj as the param. If it returns something falsy, verification will be
    // considered to have passed. If it returns something else, that will be the
    // argument to an error which is thrown to the user
    if (paramSets.validate) {
      var message = paramSets.validate(jsonObj, protocol);
      if (message) {
        throw new _errors.errors.BadParametersError(message, jsonObj);
      }
    }
  }

  // if we have no required parameters, all is well
  if (requiredParams.length === 0) {
    return;
  }

  // some clients pass in the session id in the params
  if (optionalParams.indexOf("sessionId") === -1) {
    optionalParams.push("sessionId");
  }

  // some clients pass in an element id in the params
  if (optionalParams.indexOf("id") === -1) {
    optionalParams.push("id");
  }

  // go through the required parameters and check against our arguments
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (
      var _iterator = _getIterator(requiredParams), _step;
      !(_iteratorNormalCompletion = (_step = _iterator.next()).done);
      _iteratorNormalCompletion = true
    ) {
      var params = _step.value;

      if (
        _lodash2["default"].difference(receivedParams, params, optionalParams)
          .length === 0 &&
        _lodash2["default"].difference(params, receivedParams).length === 0
      ) {
        // we have a set of parameters that is correct
        // so short-circuit
        return;
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator["return"]) {
        _iterator["return"]();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  throw new _errors.errors.BadParametersError(paramSets, receivedParams);
}

/*
 * This method takes 3 pieces of data: request parameters ('requestParams'),
 * a request JSON body ('jsonObj'), and 'payloadParams', which is the section
 * from the route definition for a particular endpoint which has instructions
 * on handling parameters. This method returns an array of arguments which will
 * be applied to a command.
 */
function makeArgs(requestParams, jsonObj, payloadParams, protocol) {
  // We want to pass the "url" parameters to the commands in reverse order
  // since the command will sometimes want to ignore, say, the sessionId.
  // This has the effect of putting sessionId last, which means in JS we can
  // omit it from the function signature if we're not going to use it.
  var urlParams = _lodash2["default"].keys(requestParams).reverse();

  // In the simple case, the required parameters are a basic array in
  // payloadParams.required, so start there. It's possible that there are
  // multiple optional sets of required params, though, so handle that case
  // too.
  var requiredParams = payloadParams.required;
  if (
    _lodash2["default"].isArray(
      _lodash2["default"].first(payloadParams.required)
    )
  ) {
    // If there are optional sets of required params, then we will have an
    // array of arrays in payloadParams.required, so loop through each set and
    // pick the one that matches which JSON params were actually sent. We've
    // already been through validation so we're guaranteed to find a match.
    var keys = _lodash2["default"].keys(jsonObj);
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (
        var _iterator2 = _getIterator(payloadParams.required), _step2;
        !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done);
        _iteratorNormalCompletion2 = true
      ) {
        var params = _step2.value;

        if (
          _lodash2["default"].without.apply(
            _lodash2["default"],
            [params].concat(_toConsumableArray(keys))
          ).length === 0
        ) {
          requiredParams = params;
          break;
        }
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2["return"]) {
          _iterator2["return"]();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }
  }

  // Now we construct our list of arguments which will be passed to the command
  var args = undefined;
  if (_lodash2["default"].isFunction(payloadParams.makeArgs)) {
    // In the route spec, a particular route might define a 'makeArgs' function
    // if it wants full control over how to turn JSON parameters into command
    // arguments. So we pass it the JSON parameters and it returns an array
    // which will be applied to the handling command. For example if it returns
    // [1, 2, 3], we will call `command(1, 2, 3, ...)` (url params are separate
    // from JSON params and get concatenated below).
    args = payloadParams.makeArgs(jsonObj, protocol);
  } else {
    // Otherwise, collect all the required and optional params and flatten them
    // into an argument array
    args = _lodash2["default"].flatten(requiredParams).map(function(p) {
      return jsonObj[p];
    });
    if (payloadParams.optional) {
      args = args.concat(
        _lodash2["default"].flatten(payloadParams.optional).map(function(p) {
          return jsonObj[p];
        })
      );
    }
  }
  // Finally, get our url params (session id, element id, etc...) on the end of
  // the list
  args = args.concat(
    urlParams.map(function(u) {
      return requestParams[u];
    })
  );
  return args;
}

function routeConfiguringFunction(driver) {
  driver.args.screenshotPath =
    driver.args.screenshotPath || driver.args.screenpath;
  if (!driver.sessionExists) {
    throw new Error("Drivers used with MJSONWP must implement `sessionExists`");
  }

  if (!(driver.executeCommand || driver.execute)) {
    throw new Error(
      "Drivers used with MJSONWP must implement `executeCommand` or `execute`"
    );
  }

  // return a function which will add all the routes to the driver
  return function(app) {
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
      for (
        var _iterator3 = _getIterator(
            _lodash2["default"].toPairs(_routes.METHOD_MAP)
          ),
          _step3;
        !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done);
        _iteratorNormalCompletion3 = true
      ) {
        var _step3$value = _slicedToArray(_step3.value, 2);

        var path = _step3$value[0];
        var methods = _step3$value[1];
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (
            var _iterator4 = _getIterator(_lodash2["default"].toPairs(methods)),
              _step4;
            !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done);
            _iteratorNormalCompletion4 = true
          ) {
            var _step4$value = _slicedToArray(_step4.value, 2);

            var method = _step4$value[0];
            var spec = _step4$value[1];

            // set up the express route handler
            buildHandler(
              app,
              method,
              path,
              spec,
              driver,
              isSessionCommand(spec.command)
            );
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4["return"]) {
              _iterator4["return"]();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }
      }
    } catch (err) {
      _didIteratorError3 = true;
      _iteratorError3 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion3 && _iterator3["return"]) {
          _iterator3["return"]();
        }
      } finally {
        if (_didIteratorError3) {
          throw _iteratorError3;
        }
      }
    }
  };
}

function buildHandler(app, method, path, spec, driver, isSessCmd) {
  var _this = this;

  var asyncHandler = function asyncHandler(req, res) {
    var jsonObj,
      httpResBody,
      httpStatus,
      newSessionId,
      isW3C,
      isMJSONWP,
      log,
      args,
      driverRes,
      parsedDriverRes,
      protocolLogger,
      actualErr,
      _getResponseForW3CError,
      _getResponseForW3CError2,
      _getResponseForJsonwpError,
      _getResponseForJsonwpError2,
      jsonwpRes,
      w3cRes;

    return _regeneratorRuntime.async(
      function asyncHandler$(context$2$0) {
        while (1)
          switch ((context$2$0.prev = context$2$0.next)) {
            case 0:
              jsonObj = req.body;
              httpResBody = {};
              httpStatus = 200;
              newSessionId = undefined;
              isW3C = undefined;
              isMJSONWP = undefined;
              log = getLogByProtocol(driver);
              context$2$0.prev = 7;

              if (!(isSessCmd && !driver.sessionExists(req.params.sessionId))) {
                context$2$0.next = 10;
                break;
              }

              throw new _errors.errors.NoSuchDriverError();

            case 10:
              if (
                !(
                  isSessCmd && driverShouldDoJwpProxy(driver, req, spec.command)
                )
              ) {
                context$2$0.next = 14;
                break;
              }

              context$2$0.next = 13;
              return _regeneratorRuntime.awrap(doJwpProxy(driver, req, res));

            case 13:
              return context$2$0.abrupt("return");

            case 14:
              if (spec.command) {
                context$2$0.next = 16;
                break;
              }

              throw new _errors.errors.NotImplementedError();

            case 16:
              // wrap params if necessary
              if (spec.payloadParams && spec.payloadParams.wrap) {
                jsonObj = wrapParams(spec.payloadParams, jsonObj);
              }

              // unwrap params if necessary
              if (spec.payloadParams && spec.payloadParams.unwrap) {
                jsonObj = unwrapParams(spec.payloadParams, jsonObj);
              }

              // ensure that the json payload conforms to the spec
              checkParams(spec.payloadParams, jsonObj, driver.protocol);
              // ensure the session the user is trying to use is valid

              // turn the command and json payload into an argument list for
              // the driver methods
              args = makeArgs(
                req.params,
                jsonObj,
                spec.payloadParams || {},
                driver.protocol
              );
              driverRes = undefined;

              // validate command args according to MJSONWP
              if (_validators.validators[spec.command]) {
                _validators.validators[spec.command].apply(
                  _validators.validators,
                  _toConsumableArray(args)
                );
              }

              // run the driver command wrapped inside the argument validators
              log.debug(
                "Calling " +
                  driver.constructor.name +
                  "." +
                  spec.command +
                  "() with args: " +
                  _lodash2["default"].truncate(JSON.stringify(args), {
                    length: LOG_OBJ_LENGTH
                  })
              );
              testwa.beforeExecuteCommand(
                driver,
                req.params.sessionId,
                spec.command
              );

              if (!driver.executeCommand) {
                context$2$0.next = 29;
                break;
              }

              context$2$0.next = 26;
              return _regeneratorRuntime.awrap(
                driver.executeCommand.apply(
                  driver,
                  [spec.command].concat(_toConsumableArray(args))
                )
              );

            case 26:
              driverRes = context$2$0.sent;
              context$2$0.next = 32;
              break;

            case 29:
              context$2$0.next = 31;
              return _regeneratorRuntime.awrap(
                driver.execute.apply(
                  driver,
                  [spec.command].concat(_toConsumableArray(args))
                )
              );

            case 31:
              driverRes = context$2$0.sent;

            case 32:
              // Get the protocol after executeCommand (when command is `createSession`, protocol is assigned within
              // createSession function)
              isW3C = driver.isW3CProtocol();
              isMJSONWP = driver.isMjsonwpProtocol();

              // If `executeCommand` was overridden and the method returns an object
              // with a protocol and value/error property, re-assign the protocol
              parsedDriverRes = parseProtocol(driverRes);

              if (!parsedDriverRes) {
                context$2$0.next = 41;
                break;
              }

              isW3C = parsedDriverRes.isW3C;
              isMJSONWP = parsedDriverRes.isMJSONWP;

              if (!parsedDriverRes.error) {
                context$2$0.next = 40;
                break;
              }

              throw parsedDriverRes.error;

            case 40:
              driverRes = parsedDriverRes.value;

            case 41:
              protocolLogger = isW3C ? w3cLog : mjsonwpLog;

              // unpack createSession response
              if (spec.command === "createSession") {
                newSessionId = driverRes[0];
                if (isMJSONWP) {
                  driverRes = driverRes[1];
                } else if (isW3C) {
                  driverRes = {
                    capabilities: driverRes[1]
                  };
                }
                if (driver && driver.args.report) {
                  testwa.initBaseDriver(driver);
                }
              }

              // If the MJSONWP element key format (ELEMENT) was provided translate it to W3C element key format (element-6066-11e4-a52e-4f735466cecf)
              // and vice-versa
              if (driverRes) {
                if (isW3C) {
                  driverRes = (0, _basedriverHelpers.renameKey)(
                    driverRes,
                    MJSONWP_ELEMENT_KEY,
                    W3C_ELEMENT_KEY
                  );
                } else {
                  driverRes = (0, _basedriverHelpers.renameKey)(
                    driverRes,
                    W3C_ELEMENT_KEY,
                    MJSONWP_ELEMENT_KEY
                  );
                }
              }

              // convert undefined to null, but leave all other values the same
              if (_lodash2["default"].isUndefined(driverRes)) {
                driverRes = null;
              }

              // delete should not return anything even if successful
              if (spec.command === "deleteSession") {
                protocolLogger.debug(
                  "Received response: " +
                    _lodash2["default"].truncate(JSON.stringify(driverRes), {
                      length: LOG_OBJ_LENGTH
                    })
                );
                protocolLogger.debug("But deleting session, so not returning");
                driverRes = null;
              }

              // if the status is not 0,  throw the appropriate error for status code.

              if (!_appiumSupport.util.hasValue(driverRes)) {
                context$2$0.next = 53;
                break;
              }

              if (
                !(
                  _appiumSupport.util.hasValue(driverRes.status) &&
                  !isNaN(driverRes.status) &&
                  parseInt(driverRes.status, 10) !== 0
                )
              ) {
                context$2$0.next = 51;
                break;
              }

              throw (0, _errors.errorFromMJSONWPStatusCode)(
                driverRes.status,
                driverRes.value
              );

            case 51:
              if (
                !(
                  _lodash2["default"].isPlainObject(driverRes.value) &&
                  driverRes.value.error
                )
              ) {
                context$2$0.next = 53;
                break;
              }

              throw (0, _errors.errorFromW3CJsonCode)(
                driverRes.value.error,
                driverRes.value.message,
                driverRes.value.stacktrace
              );

            case 53:
              // Response status should be the status set by the driver response.
              if (!isW3C) {
                httpResBody.status =
                  _lodash2["default"].isNil(driverRes) ||
                  _lodash2["default"].isUndefined(driverRes.status)
                    ? JSONWP_SUCCESS_STATUS_CODE
                    : driverRes.status;
              }
              httpResBody.value = driverRes;
              protocolLogger.debug(
                "Responding to client with driver." +
                  spec.command +
                  "() " +
                  ("result: " +
                    _lodash2["default"].truncate(JSON.stringify(driverRes), {
                      length: LOG_OBJ_LENGTH
                    }))
              );
              context$2$0.next = 67;
              break;

            case 58:
              context$2$0.prev = 58;
              context$2$0.t0 = context$2$0["catch"](7);
              actualErr = context$2$0.t0;

              if (_lodash2["default"].isUndefined(isMJSONWP)) {
                isMJSONWP = driver.isMjsonwpProtocol();
              }

              if (_lodash2["default"].isUndefined(isW3C)) {
                isW3C = driver.isW3CProtocol();
              }

              // Use the logger that's specific to this response
              protocolLogger = isW3C ? w3cLog : mjsonwpLog;

              protocolLogger.error(
                "Encountered internal error running command:  " +
                  JSON.stringify(context$2$0.t0) +
                  " " +
                  (context$2$0.t0.stacktrace || context$2$0.t0.stack)
              );
              if (
                (0, _errors.isErrorType)(
                  context$2$0.t0,
                  _errors.errors.ProxyRequestError
                )
              ) {
                actualErr = context$2$0.t0.getActualError();
              }

              if (isW3C) {
                _getResponseForW3CError = (0, _errors.getResponseForW3CError)(
                  actualErr
                );
                _getResponseForW3CError2 = _slicedToArray(
                  _getResponseForW3CError,
                  2
                );
                httpStatus = _getResponseForW3CError2[0];
                httpResBody = _getResponseForW3CError2[1];
              } else if (isMJSONWP) {
                _getResponseForJsonwpError = (0,
                _errors.getResponseForJsonwpError)(actualErr);
                _getResponseForJsonwpError2 = _slicedToArray(
                  _getResponseForJsonwpError,
                  2
                );
                httpStatus = _getResponseForJsonwpError2[0];
                httpResBody = _getResponseForJsonwpError2[1];
              } else {
                jsonwpRes = (0, _errors.getResponseForJsonwpError)(actualErr);
                w3cRes = (0, _errors.getResponseForW3CError)(actualErr);

                httpResBody = _extends({}, jsonwpRes[1], w3cRes[1]);

                // Use the JSONWP status code (which is usually 500)
                httpStatus = jsonwpRes[0];
              }

            case 67:
              // decode the response, which is either a string or json
              if (_lodash2["default"].isString(httpResBody)) {
                res.status(httpStatus).send(httpResBody);
              } else {
                if (newSessionId) {
                  if (isW3C) {
                    httpResBody.value.sessionId = newSessionId;
                  } else {
                    httpResBody.sessionId = newSessionId;
                  }
                } else {
                  httpResBody.sessionId = req.params.sessionId || null;
                }
                if (driver && (driver.args.genTool || driver.args.portal)) {
                  testwa.handler(
                    driver,
                    req,
                    httpStatus,
                    httpResBody,
                    spec.command,
                    jsonObj
                  );
                }

                // Don't include sessionId in W3C responses
                if (isW3C) {
                  delete httpResBody.sessionId;
                }
                res.status(httpStatus).json(httpResBody);
              }

            case 68:
            case "end":
              return context$2$0.stop();
          }
      },
      null,
      _this,
      [[7, 58]]
    );
  };
  // add the method to the app
  app[method.toLowerCase()](path, function(req, res) {
    _bluebird2["default"].resolve(asyncHandler(req, res)).done();
  });
}

function driverShouldDoJwpProxy(driver, req, command) {
  // drivers need to explicitly say when the proxy is active
  if (!driver.proxyActive(req.params.sessionId)) {
    return false;
  }

  // we should never proxy deleteSession because we need to give the containing
  // driver an opportunity to clean itself up
  if (command === "deleteSession") {
    return false;
  }

  // validate avoidance schema, and say we shouldn't proxy if anything in the
  // avoid list matches our req
  if (
    driver.proxyRouteIsAvoided(
      req.params.sessionId,
      req.method,
      req.originalUrl
    )
  ) {
    return false;
  }

  // if it looks like we have an image element in the url (as a route
  // parameter), never proxy. Just look for our image element prefix in allowed
  // positions (either after an 'element' or 'screenshot' path segment), and
  // ensure the prefix is followed by something
  if (IMG_EL_URL_RE.test(req.originalUrl)) {
    return false;
  }

  // also if it looks like we have an image element in the request body (as
  // a JSON parameter), never proxy. Basically check against a regexp of the
  // json string of the body, where we know what the form of an image element
  // must be
  var stringBody = JSON.stringify(req.body);
  if (stringBody && IMG_EL_BODY_RE.test(stringBody)) {
    return false;
  }

  return true;
}

function doJwpProxy(driver, req, res) {
  var proxiedRes;
  return _regeneratorRuntime.async(
    function doJwpProxy$(context$1$0) {
      while (1)
        switch ((context$1$0.prev = context$1$0.next)) {
          case 0:
            getLogByProtocol(driver).info(
              "Driver proxy active, passing request on via HTTP proxy"
            );

            // check that the inner driver has a proxy function

            if (driver.canProxy(req.params.sessionId)) {
              context$1$0.next = 3;
              break;
            }

            throw new Error(
              "Trying to proxy to a JSONWP server but driver is unable to proxy"
            );

          case 3:
            context$1$0.prev = 3;
            context$1$0.next = 6;
            return _regeneratorRuntime.awrap(
              driver.executeCommand(
                "proxyReqRes",
                req,
                res,
                req.params.sessionId
              )
            );

          case 6:
            proxiedRes = context$1$0.sent;

            if (!(proxiedRes && proxiedRes.error)) {
              context$1$0.next = 9;
              break;
            }

            throw proxiedRes.error;

          case 9:
            context$1$0.next = 18;
            break;

          case 11:
            context$1$0.prev = 11;
            context$1$0.t0 = context$1$0["catch"](3);

            if (
              !(0, _errors.isErrorType)(
                context$1$0.t0,
                _errors.errors.ProxyRequestError
              )
            ) {
              context$1$0.next = 17;
              break;
            }

            throw context$1$0.t0;

          case 17:
            throw new Error(
              "Could not proxy. Proxy error: " + context$1$0.t0.message
            );

          case 18:
          case "end":
            return context$1$0.stop();
        }
    },
    null,
    this,
    [[3, 11]]
  );
}

/**
 * Check a driver command respond and see if the protocol and value was passed in
 * @param {Object} driverRes Response returned by `executeCommand` in an inner driver
 * @returns {?Object} Object of the form {isW3C, isMJSONWP, value|error} or null if it isn't parsable
 */
function parseProtocol(driverRes) {
  if (
    !_lodash2["default"].isPlainObject(driverRes) ||
    !_lodash2["default"].isString(driverRes.protocol)
  ) {
    return null;
  }

  var isW3C =
    driverRes.protocol === _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C;
  var isMJSONWP =
    driverRes.protocol ===
    _basedriverDriver2["default"].DRIVER_PROTOCOL.MJSONWP;

  if (_lodash2["default"].has(driverRes, "value")) {
    return { isW3C: isW3C, isMJSONWP: isMJSONWP, value: driverRes.value };
  }

  if (_lodash2["default"].isError(driverRes.error)) {
    return { isW3C: isW3C, isMJSONWP: isMJSONWP, error: driverRes.error };
  }

  return null;
}

exports.Protocol = Protocol;
exports.routeConfiguringFunction = routeConfiguringFunction;
exports.isSessionCommand = isSessionCommand;
exports.MJSONWP_ELEMENT_KEY = MJSONWP_ELEMENT_KEY;
exports.W3C_ELEMENT_KEY = W3C_ELEMENT_KEY;
exports.IMAGE_ELEMENT_PREFIX = IMAGE_ELEMENT_PREFIX;
exports.parseProtocol = parseProtocol;
exports.driverShouldDoJwpProxy = driverShouldDoJwpProxy;

// get the appropriate logger depending on the protocol that is being used

// if this is a session command but we don't have a session,
// error out early (especially before proxying)

// if the driver is currently proxying commands to another JSONWP
// server, bypass all our checks and assume the upstream server knows
// what it's doing. But keep this in the try/catch block so if proxying
// itself fails, we give a message to the client. Of course we only
// want to do these when we have a session command; the Appium driver
// must be responsible for start/stop session, etc...

// if a command is not in our method map, it's because we
// have no plans to ever implement it

// Use the logger that's specific to this response

// if anything goes wrong, figure out what our response should be
// based on the type of error that we encountered

// If it's unknown what the protocol is (like if it's `getStatus` prior to `createSession`), merge the responses
// together to be protocol-agnostic
// eslint-disable-line curly
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9wcm90b2NvbC9wcm90b2NvbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztzQkFBYyxRQUFROzs7OzZCQUNPLGdCQUFnQjs7MEJBQ2xCLGNBQWM7O3NCQUV5QixVQUFVOztzQkFDekIsVUFBVTs7aUNBQ25DLHVCQUF1Qjs7d0JBQ25DLFVBQVU7Ozs7Z0NBQ0Qsc0JBQXNCOzs7O0FBRzdDLElBQU0sVUFBVSxHQUFHLHNCQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQyxJQUFNLE1BQU0sR0FBRyxzQkFBTyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7O0FBRXZDLElBQU0sMEJBQTBCLEdBQUcsQ0FBQyxDQUFDOztBQUVyQyxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7O0FBRTVCLElBQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBQ3RDLElBQU0sZUFBZSxHQUFHLHFDQUFxQyxDQUFDO0FBQzlELElBQU0sb0JBQW9CLEdBQUcsdUJBQXVCLENBQUM7O0FBRXJELElBQU0sY0FBYyxHQUFHLElBQUksTUFBTSxDQUMvQixPQUFLLGVBQWUsU0FBSSxtQkFBbUIsb0JBQ3ZDLG9CQUFvQixZQUFRLENBQ2pDLENBQUM7QUFDRixJQUFNLGFBQWEsR0FBRyxJQUFJLE1BQU0sQ0FDOUIsaUNBQ0ksb0JBQW9CLFdBQU8sQ0FDaEMsQ0FBQzs7SUFFSSxRQUFRLFlBQVIsUUFBUTt3QkFBUixRQUFROzs7QUFFZCxTQUFTLGdCQUFnQixDQUFFLE1BQU0sRUFBRTtBQUNqQyxTQUFPLE1BQU0sQ0FBQyxhQUFhLEVBQUUsR0FBRyxNQUFNLEdBQUcsVUFBVSxDQUFDO0NBQ3JEOztBQUVELFNBQVMsZ0JBQWdCLENBQUUsT0FBTyxFQUFFO0FBQ2xDLFNBQU8sQ0FBQyxvQkFBRSxRQUFRLGlDQUF5QixPQUFPLENBQUMsQ0FBQztDQUNyRDs7QUFFRCxTQUFTLFVBQVUsQ0FBRSxTQUFTLEVBQUUsT0FBTyxFQUFFOzs7Ozs7O0FB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QUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzlCLFdBQU8sRUFBQyxLQUFLLEVBQUwsS0FBSyxFQUFFLFNBQVMsRUFBVCxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUMsQ0FBQztHQUNuRDs7QUFFRCxTQUFPLElBQUksQ0FBQztDQUNiOztRQUdRLFFBQVEsR0FBUixRQUFRO1FBQUUsd0JBQXdCLEdBQXhCLHdCQUF3QjtRQUFFLGdCQUFnQixHQUFoQixnQkFBZ0I7UUFDcEQsbUJBQW1CLEdBQW5CLG1CQUFtQjtRQUFFLGVBQWUsR0FBZixlQUFlO1FBQUUsb0JBQW9CLEdBQXBCLG9CQUFvQjtRQUFFLGFBQWEsR0FBYixhQUFhO1FBQ3pFLHNCQUFzQixHQUF0QixzQkFBc0IiLCJmaWxlIjoibGliL3Byb3RvY29sL3Byb3RvY29sLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCB7IGxvZ2dlciwgdXRpbCB9IGZyb20gJ2FwcGl1bS1zdXBwb3J0JztcbmltcG9ydCB7IHZhbGlkYXRvcnMgfSBmcm9tICcuL3ZhbGlkYXRvcnMnO1xuaW1wb3J0IHsgZXJyb3JzLCBpc0Vycm9yVHlwZSwgZXJyb3JGcm9tTUpTT05XUFN0YXR1c0NvZGUsIGVycm9yRnJvbVczQ0pzb25Db2RlLFxuICAgICAgICAgZ2V0UmVzcG9uc2VGb3JXM0NFcnJvciwgZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvciB9IGZyb20gJy4vZXJyb3JzJztcbmltcG9ydCB7IE1FVEhPRF9NQVAsIE5PX1NFU1NJT05fSURfQ09NTUFORFMgfSBmcm9tICcuL3JvdXRlcyc7XG5pbXBvcnQgeyByZW5hbWVLZXkgfSBmcm9tICcuLi9iYXNlZHJpdmVyL2hlbHBlcnMnO1xuaW1wb3J0IEIgZnJvbSAnYmx1ZWJpcmQnO1xuaW1wb3J0IEJhc2VEcml2ZXIgZnJvbSAnLi4vYmFzZWRyaXZlci9kcml2ZXInO1xuXG5cbmNvbnN0IG1qc29ud3BMb2cgPSBsb2dnZXIuZ2V0TG9nZ2VyKCdNSlNPTldQJyk7XG5jb25zdCB3M2NMb2cgPSBsb2dnZXIuZ2V0TG9nZ2VyKCdXM0MnKTtcblxuY29uc3QgSlNPTldQX1NVQ0NFU1NfU1RBVFVTX0NPREUgPSAwO1xuLy8gVE9ETzogTWFrZSB0aGlzIHZhbHVlIGNvbmZpZ3VyYWJsZSBhcyBhIHNlcnZlciBzaWRlIGNhcGFiaWxpdHlcbmNvbnN0IExPR19PQkpfTEVOR1RIID0gMTAyNDsgLy8gTUFYIExFTkdUSCBMb2dnZWQgdG8gZmlsZSAvIGNvbnNvbGVcblxuY29uc3QgTUpTT05XUF9FTEVNRU5UX0tFWSA9ICdFTEVNRU5UJztcbmNvbnN0IFczQ19FTEVNRU5UX0tFWSA9ICdlbGVtZW50LTYwNjYtMTFlNC1hNTJlLTRmNzM1NDY2Y2VjZic7XG5jb25zdCBJTUFHRV9FTEVNRU5UX1BSRUZJWCA9ICdhcHBpdW0taW1hZ2UtZWxlbWVudC0nO1xuXG5jb25zdCBJTUdfRUxfQk9EWV9SRSA9IG5ldyBSZWdFeHAoXG4gIGBcIigke1czQ19FTEVNRU5UX0tFWX18JHtNSlNPTldQX0VMRU1FTlRfS0VZfSlcIjpcXHMqYCArXG4gIGBcIiR7SU1BR0VfRUxFTUVOVF9QUkVGSVh9W15cIl0rXCJgXG4pO1xuY29uc3QgSU1HX0VMX1VSTF9SRSA9IG5ldyBSZWdFeHAoXG4gIGAvKGVsZW1lbnR8c2NyZWVuc2hvdClgICtcbiAgYC8ke0lNQUdFX0VMRU1FTlRfUFJFRklYfVteL10rYFxuKTtcblxuY2xhc3MgUHJvdG9jb2wge31cblxuZnVuY3Rpb24gZ2V0TG9nQnlQcm90b2NvbCAoZHJpdmVyKSB7XG4gIHJldHVybiBkcml2ZXIuaXNXM0NQcm90b2NvbCgpID8gdzNjTG9nIDogbWpzb253cExvZztcbn1cblxuZnVuY3Rpb24gaXNTZXNzaW9uQ29tbWFuZCAoY29tbWFuZCkge1xuICByZXR1cm4gIV8uaW5jbHVkZXMoTk9fU0VTU0lPTl9JRF9DT01NQU5EUywgY29tbWFuZCk7XG59XG5cbmZ1bmN0aW9uIHdyYXBQYXJhbXMgKHBhcmFtU2V0cywganNvbk9iaikge1xuICAvKiBUaGVyZSBhcmUgY29tbWFuZHMgbGlrZSBwZXJmb3JtVG91Y2ggd2hpY2ggdGFrZSBhIHNpbmdsZSBwYXJhbWV0ZXIgKHByaW1pdGl2ZSB0eXBlIG9yIGFycmF5KS5cbiAgICogU29tZSBkcml2ZXJzIGNob29zZSB0byBwYXNzIHRoaXMgcGFyYW1ldGVyIGFzIGEgdmFsdWUgKGVnLiBbYWN0aW9uMSwgYWN0aW9uMi4uLl0pIHdoaWxlIG90aGVycyB0b1xuICAgKiB3cmFwIGl0IHdpdGhpbiBhbiBvYmplY3QoZWcnIHtnZXN0dXJlOiAgW2FjdGlvbjEsIGFjdGlvbjIuLi5dfSksIHdoaWNoIG1ha2VzIGl0IGhhcmQgdG8gdmFsaWRhdGUuXG4gICAqIFRoZSB3cmFwIG9wdGlvbiBpbiB0aGUgc3BlYyBlbmZvcmNlIHdyYXBwaW5nIGJlZm9yZSB2YWxpZGF0aW9uLCBzbyB0aGF0IGFsbCBwYXJhbXMgYXJlIHdyYXBwZWQgYXRcbiAgICogdGhlIHRpbWUgdGhleSBhcmUgdmFsaWRhdGVkIGFuZCBsYXRlciBwYXNzZWQgdG8gdGhlIGNvbW1hbmRzLlxuICAgKi9cbiAgbGV0IHJlcyA9IGpzb25PYmo7XG4gIGlmIChfLmlzQXJyYXkoanNvbk9iaikgfHwgIV8uaXNPYmplY3QoanNvbk9iaikpIHtcbiAgICByZXMgPSB7fTtcbiAgICByZXNbcGFyYW1TZXRzLndyYXBdID0ganNvbk9iajtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiB1bndyYXBQYXJhbXMgKHBhcmFtU2V0cywganNvbk9iaikge1xuICAvKiBUaGVyZSBhcmUgY29tbWFuZHMgbGlrZSBzZXROZXR3b3JrQ29ubmVjdGlvbiB3aGljaCBzZW5kIHBhcmFtZXRlcnMgd3JhcHBlZCBpbnNpZGUgYSBrZXkgc3VjaCBhc1xuICAgKiBcInBhcmFtZXRlcnNcIi4gVGhpcyBmdW5jdGlvbiB1bndyYXBzIHRoZW0gKGVnLiB7XCJwYXJhbWV0ZXJzXCI6IHtcInR5cGVcIjogMX19IGJlY29tZXMge1widHlwZVwiOiAxfSkuXG4gICAqL1xuICBsZXQgcmVzID0ganNvbk9iajtcbiAgaWYgKF8uaXNPYmplY3QoanNvbk9iaikpIHtcbiAgICAvLyBzb21lIGNsaWVudHMsIGxpa2UgcnVieSwgZG9uJ3Qgd3JhcFxuICAgIGlmIChqc29uT2JqW3BhcmFtU2V0cy51bndyYXBdKSB7XG4gICAgICByZXMgPSBqc29uT2JqW3BhcmFtU2V0cy51bndyYXBdO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiBjaGVja1BhcmFtcyAocGFyYW1TZXRzLCBqc29uT2JqLCBwcm90b2NvbCkge1xuICBsZXQgcmVxdWlyZWRQYXJhbXMgPSBbXTtcbiAgbGV0IG9wdGlvbmFsUGFyYW1zID0gW107XG4gIGxldCByZWNlaXZlZFBhcmFtcyA9IF8ua2V5cyhqc29uT2JqKTtcblxuICBpZiAocGFyYW1TZXRzKSB7XG4gICAgaWYgKHBhcmFtU2V0cy5yZXF1aXJlZCkge1xuICAgICAgLy8gd2UgbWlnaHQgaGF2ZSBhbiBhcnJheSBvZiBwYXJhbWV0ZXJzLFxuICAgICAgLy8gb3IgYW4gYXJyYXkgb2YgYXJyYXlzIG9mIHBhcmFtZXRlcnMsIHNvIHN0YW5kYXJkaXplXG4gICAgICBpZiAoIV8uaXNBcnJheShfLmZpcnN0KHBhcmFtU2V0cy5yZXF1aXJlZCkpKSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW1zID0gW3BhcmFtU2V0cy5yZXF1aXJlZF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXF1aXJlZFBhcmFtcyA9IHBhcmFtU2V0cy5yZXF1aXJlZDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gb3B0aW9uYWwgcGFyYW1ldGVycyBhcmUganVzdCBhbiBhcnJheVxuICAgIGlmIChwYXJhbVNldHMub3B0aW9uYWwpIHtcbiAgICAgIG9wdGlvbmFsUGFyYW1zID0gcGFyYW1TZXRzLm9wdGlvbmFsO1xuICAgIH1cblxuICAgIC8vIElmIGEgZnVuY3Rpb24gd2FzIHByb3ZpZGVkIGFzIHRoZSAndmFsaWRhdGUnIGtleSwgaXQgd2lsbCBoZXJlIGJlIGNhbGxlZCB3aXRoXG4gICAgLy8ganNvbk9iaiBhcyB0aGUgcGFyYW0uIElmIGl0IHJldHVybnMgc29tZXRoaW5nIGZhbHN5LCB2ZXJpZmljYXRpb24gd2lsbCBiZVxuICAgIC8vIGNvbnNpZGVyZWQgdG8gaGF2ZSBwYXNzZWQuIElmIGl0IHJldHVybnMgc29tZXRoaW5nIGVsc2UsIHRoYXQgd2lsbCBiZSB0aGVcbiAgICAvLyBhcmd1bWVudCB0byBhbiBlcnJvciB3aGljaCBpcyB0aHJvd24gdG8gdGhlIHVzZXJcbiAgICBpZiAocGFyYW1TZXRzLnZhbGlkYXRlKSB7XG4gICAgICBsZXQgbWVzc2FnZSA9IHBhcmFtU2V0cy52YWxpZGF0ZShqc29uT2JqLCBwcm90b2NvbCk7XG4gICAgICBpZiAobWVzc2FnZSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkJhZFBhcmFtZXRlcnNFcnJvcihtZXNzYWdlLCBqc29uT2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBpZiB3ZSBoYXZlIG5vIHJlcXVpcmVkIHBhcmFtZXRlcnMsIGFsbCBpcyB3ZWxsXG4gIGlmIChyZXF1aXJlZFBhcmFtcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBzb21lIGNsaWVudHMgcGFzcyBpbiB0aGUgc2Vzc2lvbiBpZCBpbiB0aGUgcGFyYW1zXG4gIGlmIChvcHRpb25hbFBhcmFtcy5pbmRleE9mKCdzZXNzaW9uSWQnKSA9PT0gLTEpIHtcbiAgICBvcHRpb25hbFBhcmFtcy5wdXNoKCdzZXNzaW9uSWQnKTtcbiAgfVxuXG4gIC8vIHNvbWUgY2xpZW50cyBwYXNzIGluIGFuIGVsZW1lbnQgaWQgaW4gdGhlIHBhcmFtc1xuICBpZiAob3B0aW9uYWxQYXJhbXMuaW5kZXhPZignaWQnKSA9PT0gLTEpIHtcbiAgICBvcHRpb25hbFBhcmFtcy5wdXNoKCdpZCcpO1xuICB9XG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgcmVxdWlyZWQgcGFyYW1ldGVycyBhbmQgY2hlY2sgYWdhaW5zdCBvdXIgYXJndW1lbnRzXG4gIGZvciAobGV0IHBhcmFtcyBvZiByZXF1aXJlZFBhcmFtcykge1xuICAgIGlmIChfLmRpZmZlcmVuY2UocmVjZWl2ZWRQYXJhbXMsIHBhcmFtcywgb3B0aW9uYWxQYXJhbXMpLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICBfLmRpZmZlcmVuY2UocGFyYW1zLCByZWNlaXZlZFBhcmFtcykubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyB3ZSBoYXZlIGEgc2V0IG9mIHBhcmFtZXRlcnMgdGhhdCBpcyBjb3JyZWN0XG4gICAgICAvLyBzbyBzaG9ydC1jaXJjdWl0XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBlcnJvcnMuQmFkUGFyYW1ldGVyc0Vycm9yKHBhcmFtU2V0cywgcmVjZWl2ZWRQYXJhbXMpO1xufVxuXG4vKlxuICogVGhpcyBtZXRob2QgdGFrZXMgMyBwaWVjZXMgb2YgZGF0YTogcmVxdWVzdCBwYXJhbWV0ZXJzICgncmVxdWVzdFBhcmFtcycpLFxuICogYSByZXF1ZXN0IEpTT04gYm9keSAoJ2pzb25PYmonKSwgYW5kICdwYXlsb2FkUGFyYW1zJywgd2hpY2ggaXMgdGhlIHNlY3Rpb25cbiAqIGZyb20gdGhlIHJvdXRlIGRlZmluaXRpb24gZm9yIGEgcGFydGljdWxhciBlbmRwb2ludCB3aGljaCBoYXMgaW5zdHJ1Y3Rpb25zXG4gKiBvbiBoYW5kbGluZyBwYXJhbWV0ZXJzLiBUaGlzIG1ldGhvZCByZXR1cm5zIGFuIGFycmF5IG9mIGFyZ3VtZW50cyB3aGljaCB3aWxsXG4gKiBiZSBhcHBsaWVkIHRvIGEgY29tbWFuZC5cbiAqL1xuZnVuY3Rpb24gbWFrZUFyZ3MgKHJlcXVlc3RQYXJhbXMsIGpzb25PYmosIHBheWxvYWRQYXJhbXMsIHByb3RvY29sKSB7XG4gIC8vIFdlIHdhbnQgdG8gcGFzcyB0aGUgXCJ1cmxcIiBwYXJhbWV0ZXJzIHRvIHRoZSBjb21tYW5kcyBpbiByZXZlcnNlIG9yZGVyXG4gIC8vIHNpbmNlIHRoZSBjb21tYW5kIHdpbGwgc29tZXRpbWVzIHdhbnQgdG8gaWdub3JlLCBzYXksIHRoZSBzZXNzaW9uSWQuXG4gIC8vIFRoaXMgaGFzIHRoZSBlZmZlY3Qgb2YgcHV0dGluZyBzZXNzaW9uSWQgbGFzdCwgd2hpY2ggbWVhbnMgaW4gSlMgd2UgY2FuXG4gIC8vIG9taXQgaXQgZnJvbSB0aGUgZnVuY3Rpb24gc2lnbmF0dXJlIGlmIHdlJ3JlIG5vdCBnb2luZyB0byB1c2UgaXQuXG4gIGxldCB1cmxQYXJhbXMgPSBfLmtleXMocmVxdWVzdFBhcmFtcykucmV2ZXJzZSgpO1xuXG4gIC8vIEluIHRoZSBzaW1wbGUgY2FzZSwgdGhlIHJlcXVpcmVkIHBhcmFtZXRlcnMgYXJlIGEgYmFzaWMgYXJyYXkgaW5cbiAgLy8gcGF5bG9hZFBhcmFtcy5yZXF1aXJlZCwgc28gc3RhcnQgdGhlcmUuIEl0J3MgcG9zc2libGUgdGhhdCB0aGVyZSBhcmVcbiAgLy8gbXVsdGlwbGUgb3B0aW9uYWwgc2V0cyBvZiByZXF1aXJlZCBwYXJhbXMsIHRob3VnaCwgc28gaGFuZGxlIHRoYXQgY2FzZVxuICAvLyB0b28uXG4gIGxldCByZXF1aXJlZFBhcmFtcyA9IHBheWxvYWRQYXJhbXMucmVxdWlyZWQ7XG4gIGlmIChfLmlzQXJyYXkoXy5maXJzdChwYXlsb2FkUGFyYW1zLnJlcXVpcmVkKSkpIHtcbiAgICAvLyBJZiB0aGVyZSBhcmUgb3B0aW9uYWwgc2V0cyBvZiByZXF1aXJlZCBwYXJhbXMsIHRoZW4gd2Ugd2lsbCBoYXZlIGFuXG4gICAgLy8gYXJyYXkgb2YgYXJyYXlzIGluIHBheWxvYWRQYXJhbXMucmVxdWlyZWQsIHNvIGxvb3AgdGhyb3VnaCBlYWNoIHNldCBhbmRcbiAgICAvLyBwaWNrIHRoZSBvbmUgdGhhdCBtYXRjaGVzIHdoaWNoIEpTT04gcGFyYW1zIHdlcmUgYWN0dWFsbHkgc2VudC4gV2UndmVcbiAgICAvLyBhbHJlYWR5IGJlZW4gdGhyb3VnaCB2YWxpZGF0aW9uIHNvIHdlJ3JlIGd1YXJhbnRlZWQgdG8gZmluZCBhIG1hdGNoLlxuICAgIGxldCBrZXlzID0gXy5rZXlzKGpzb25PYmopO1xuICAgIGZvciAobGV0IHBhcmFtcyBvZiBwYXlsb2FkUGFyYW1zLnJlcXVpcmVkKSB7XG4gICAgICBpZiAoXy53aXRob3V0KHBhcmFtcywgLi4ua2V5cykubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW1zID0gcGFyYW1zO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBOb3cgd2UgY29uc3RydWN0IG91ciBsaXN0IG9mIGFyZ3VtZW50cyB3aGljaCB3aWxsIGJlIHBhc3NlZCB0byB0aGUgY29tbWFuZFxuICBsZXQgYXJncztcbiAgaWYgKF8uaXNGdW5jdGlvbihwYXlsb2FkUGFyYW1zLm1ha2VBcmdzKSkge1xuICAgIC8vIEluIHRoZSByb3V0ZSBzcGVjLCBhIHBhcnRpY3VsYXIgcm91dGUgbWlnaHQgZGVmaW5lIGEgJ21ha2VBcmdzJyBmdW5jdGlvblxuICAgIC8vIGlmIGl0IHdhbnRzIGZ1bGwgY29udHJvbCBvdmVyIGhvdyB0byB0dXJuIEpTT04gcGFyYW1ldGVycyBpbnRvIGNvbW1hbmRcbiAgICAvLyBhcmd1bWVudHMuIFNvIHdlIHBhc3MgaXQgdGhlIEpTT04gcGFyYW1ldGVycyBhbmQgaXQgcmV0dXJucyBhbiBhcnJheVxuICAgIC8vIHdoaWNoIHdpbGwgYmUgYXBwbGllZCB0byB0aGUgaGFuZGxpbmcgY29tbWFuZC4gRm9yIGV4YW1wbGUgaWYgaXQgcmV0dXJuc1xuICAgIC8vIFsxLCAyLCAzXSwgd2Ugd2lsbCBjYWxsIGBjb21tYW5kKDEsIDIsIDMsIC4uLilgICh1cmwgcGFyYW1zIGFyZSBzZXBhcmF0ZVxuICAgIC8vIGZyb20gSlNPTiBwYXJhbXMgYW5kIGdldCBjb25jYXRlbmF0ZWQgYmVsb3cpLlxuICAgIGFyZ3MgPSBwYXlsb2FkUGFyYW1zLm1ha2VBcmdzKGpzb25PYmosIHByb3RvY29sKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBPdGhlcndpc2UsIGNvbGxlY3QgYWxsIHRoZSByZXF1aXJlZCBhbmQgb3B0aW9uYWwgcGFyYW1zIGFuZCBmbGF0dGVuIHRoZW1cbiAgICAvLyBpbnRvIGFuIGFyZ3VtZW50IGFycmF5XG4gICAgYXJncyA9IF8uZmxhdHRlbihyZXF1aXJlZFBhcmFtcykubWFwKChwKSA9PiBqc29uT2JqW3BdKTtcbiAgICBpZiAocGF5bG9hZFBhcmFtcy5vcHRpb25hbCkge1xuICAgICAgYXJncyA9IGFyZ3MuY29uY2F0KF8uZmxhdHRlbihwYXlsb2FkUGFyYW1zLm9wdGlvbmFsKS5tYXAoKHApID0+IGpzb25PYmpbcF0pKTtcbiAgICB9XG4gIH1cbiAgLy8gRmluYWxseSwgZ2V0IG91ciB1cmwgcGFyYW1zIChzZXNzaW9uIGlkLCBlbGVtZW50IGlkLCBldGMuLi4pIG9uIHRoZSBlbmQgb2ZcbiAgLy8gdGhlIGxpc3RcbiAgYXJncyA9IGFyZ3MuY29uY2F0KHVybFBhcmFtcy5tYXAoKHUpID0+IHJlcXVlc3RQYXJhbXNbdV0pKTtcbiAgcmV0dXJuIGFyZ3M7XG59XG5cbmZ1bmN0aW9uIHJvdXRlQ29uZmlndXJpbmdGdW5jdGlvbiAoZHJpdmVyKSB7XG4gIGlmICghZHJpdmVyLnNlc3Npb25FeGlzdHMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0RyaXZlcnMgdXNlZCB3aXRoIE1KU09OV1AgbXVzdCBpbXBsZW1lbnQgYHNlc3Npb25FeGlzdHNgJyk7XG4gIH1cblxuICBpZiAoIShkcml2ZXIuZXhlY3V0ZUNvbW1hbmQgfHwgZHJpdmVyLmV4ZWN1dGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdEcml2ZXJzIHVzZWQgd2l0aCBNSlNPTldQIG11c3QgaW1wbGVtZW50IGBleGVjdXRlQ29tbWFuZGAgb3IgYGV4ZWN1dGVgJyk7XG4gIH1cblxuICAvLyByZXR1cm4gYSBmdW5jdGlvbiB3aGljaCB3aWxsIGFkZCBhbGwgdGhlIHJvdXRlcyB0byB0aGUgZHJpdmVyXG4gIHJldHVybiBmdW5jdGlvbiAoYXBwKSB7XG4gICAgZm9yIChsZXQgW3BhdGgsIG1ldGhvZHNdIG9mIF8udG9QYWlycyhNRVRIT0RfTUFQKSkge1xuICAgICAgZm9yIChsZXQgW21ldGhvZCwgc3BlY10gb2YgXy50b1BhaXJzKG1ldGhvZHMpKSB7XG4gICAgICAgIC8vIHNldCB1cCB0aGUgZXhwcmVzcyByb3V0ZSBoYW5kbGVyXG4gICAgICAgIGJ1aWxkSGFuZGxlcihhcHAsIG1ldGhvZCwgcGF0aCwgc3BlYywgZHJpdmVyLCBpc1Nlc3Npb25Db21tYW5kKHNwZWMuY29tbWFuZCkpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRIYW5kbGVyIChhcHAsIG1ldGhvZCwgcGF0aCwgc3BlYywgZHJpdmVyLCBpc1Nlc3NDbWQpIHtcbiAgbGV0IGFzeW5jSGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICAgIGxldCBqc29uT2JqID0gcmVxLmJvZHk7XG4gICAgbGV0IGh0dHBSZXNCb2R5ID0ge307XG4gICAgbGV0IGh0dHBTdGF0dXMgPSAyMDA7XG4gICAgbGV0IG5ld1Nlc3Npb25JZDtcbiAgICBsZXQgaXNXM0M7XG4gICAgbGV0IGlzTUpTT05XUDtcblxuICAgIC8vIGdldCB0aGUgYXBwcm9wcmlhdGUgbG9nZ2VyIGRlcGVuZGluZyBvbiB0aGUgcHJvdG9jb2wgdGhhdCBpcyBiZWluZyB1c2VkXG4gICAgY29uc3QgbG9nID0gZ2V0TG9nQnlQcm90b2NvbChkcml2ZXIpO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIGlmIHRoaXMgaXMgYSBzZXNzaW9uIGNvbW1hbmQgYnV0IHdlIGRvbid0IGhhdmUgYSBzZXNzaW9uLFxuICAgICAgLy8gZXJyb3Igb3V0IGVhcmx5IChlc3BlY2lhbGx5IGJlZm9yZSBwcm94eWluZylcbiAgICAgIGlmIChpc1Nlc3NDbWQgJiYgIWRyaXZlci5zZXNzaW9uRXhpc3RzKHJlcS5wYXJhbXMuc2Vzc2lvbklkKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLk5vU3VjaERyaXZlckVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHRoZSBkcml2ZXIgaXMgY3VycmVudGx5IHByb3h5aW5nIGNvbW1hbmRzIHRvIGFub3RoZXIgSlNPTldQXG4gICAgICAvLyBzZXJ2ZXIsIGJ5cGFzcyBhbGwgb3VyIGNoZWNrcyBhbmQgYXNzdW1lIHRoZSB1cHN0cmVhbSBzZXJ2ZXIga25vd3NcbiAgICAgIC8vIHdoYXQgaXQncyBkb2luZy4gQnV0IGtlZXAgdGhpcyBpbiB0aGUgdHJ5L2NhdGNoIGJsb2NrIHNvIGlmIHByb3h5aW5nXG4gICAgICAvLyBpdHNlbGYgZmFpbHMsIHdlIGdpdmUgYSBtZXNzYWdlIHRvIHRoZSBjbGllbnQuIE9mIGNvdXJzZSB3ZSBvbmx5XG4gICAgICAvLyB3YW50IHRvIGRvIHRoZXNlIHdoZW4gd2UgaGF2ZSBhIHNlc3Npb24gY29tbWFuZDsgdGhlIEFwcGl1bSBkcml2ZXJcbiAgICAgIC8vIG11c3QgYmUgcmVzcG9uc2libGUgZm9yIHN0YXJ0L3N0b3Agc2Vzc2lvbiwgZXRjLi4uXG4gICAgICBpZiAoaXNTZXNzQ21kICYmIGRyaXZlclNob3VsZERvSndwUHJveHkoZHJpdmVyLCByZXEsIHNwZWMuY29tbWFuZCkpIHtcbiAgICAgICAgYXdhaXQgZG9Kd3BQcm94eShkcml2ZXIsIHJlcSwgcmVzKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBpZiBhIGNvbW1hbmQgaXMgbm90IGluIG91ciBtZXRob2QgbWFwLCBpdCdzIGJlY2F1c2Ugd2VcbiAgICAgIC8vIGhhdmUgbm8gcGxhbnMgdG8gZXZlciBpbXBsZW1lbnQgaXRcbiAgICAgIGlmICghc3BlYy5jb21tYW5kKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuTm90SW1wbGVtZW50ZWRFcnJvcigpO1xuICAgICAgfVxuXG4gICAgICAvLyB3cmFwIHBhcmFtcyBpZiBuZWNlc3NhcnlcbiAgICAgIGlmIChzcGVjLnBheWxvYWRQYXJhbXMgJiYgc3BlYy5wYXlsb2FkUGFyYW1zLndyYXApIHtcbiAgICAgICAganNvbk9iaiA9IHdyYXBQYXJhbXMoc3BlYy5wYXlsb2FkUGFyYW1zLCBqc29uT2JqKTtcbiAgICAgIH1cblxuICAgICAgLy8gdW53cmFwIHBhcmFtcyBpZiBuZWNlc3NhcnlcbiAgICAgIGlmIChzcGVjLnBheWxvYWRQYXJhbXMgJiYgc3BlYy5wYXlsb2FkUGFyYW1zLnVud3JhcCkge1xuICAgICAgICBqc29uT2JqID0gdW53cmFwUGFyYW1zKHNwZWMucGF5bG9hZFBhcmFtcywganNvbk9iaik7XG4gICAgICB9XG5cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHRoZSBqc29uIHBheWxvYWQgY29uZm9ybXMgdG8gdGhlIHNwZWNcbiAgICAgIGNoZWNrUGFyYW1zKHNwZWMucGF5bG9hZFBhcmFtcywganNvbk9iaiwgZHJpdmVyLnByb3RvY29sKTtcbiAgICAgIC8vIGVuc3VyZSB0aGUgc2Vzc2lvbiB0aGUgdXNlciBpcyB0cnlpbmcgdG8gdXNlIGlzIHZhbGlkXG5cbiAgICAgIC8vIHR1cm4gdGhlIGNvbW1hbmQgYW5kIGpzb24gcGF5bG9hZCBpbnRvIGFuIGFyZ3VtZW50IGxpc3QgZm9yXG4gICAgICAvLyB0aGUgZHJpdmVyIG1ldGhvZHNcbiAgICAgIGxldCBhcmdzID0gbWFrZUFyZ3MocmVxLnBhcmFtcywganNvbk9iaiwgc3BlYy5wYXlsb2FkUGFyYW1zIHx8IHt9LCBkcml2ZXIucHJvdG9jb2wpO1xuICAgICAgbGV0IGRyaXZlclJlcztcbiAgICAgIC8vIHZhbGlkYXRlIGNvbW1hbmQgYXJncyBhY2NvcmRpbmcgdG8gTUpTT05XUFxuICAgICAgaWYgKHZhbGlkYXRvcnNbc3BlYy5jb21tYW5kXSkge1xuICAgICAgICB2YWxpZGF0b3JzW3NwZWMuY29tbWFuZF0oLi4uYXJncyk7XG4gICAgICB9XG5cbiAgICAgIC8vIHJ1biB0aGUgZHJpdmVyIGNvbW1hbmQgd3JhcHBlZCBpbnNpZGUgdGhlIGFyZ3VtZW50IHZhbGlkYXRvcnNcbiAgICAgIGxvZy5kZWJ1ZyhgQ2FsbGluZyAke2RyaXZlci5jb25zdHJ1Y3Rvci5uYW1lfS4ke3NwZWMuY29tbWFuZH0oKSB3aXRoIGFyZ3M6IGAgK1xuICAgICAgICAgICAgICAgIF8udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoYXJncyksIHtsZW5ndGg6IExPR19PQkpfTEVOR1RIfSkpO1xuXG4gICAgICBpZiAoZHJpdmVyLmV4ZWN1dGVDb21tYW5kKSB7XG4gICAgICAgIGRyaXZlclJlcyA9IGF3YWl0IGRyaXZlci5leGVjdXRlQ29tbWFuZChzcGVjLmNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZHJpdmVyUmVzID0gYXdhaXQgZHJpdmVyLmV4ZWN1dGUoc3BlYy5jb21tYW5kLCAuLi5hcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IHRoZSBwcm90b2NvbCBhZnRlciBleGVjdXRlQ29tbWFuZCAod2hlbiBjb21tYW5kIGlzIGBjcmVhdGVTZXNzaW9uYCwgcHJvdG9jb2wgaXMgYXNzaWduZWQgd2l0aGluXG4gICAgICAvLyBjcmVhdGVTZXNzaW9uIGZ1bmN0aW9uKVxuICAgICAgaXNXM0MgPSBkcml2ZXIuaXNXM0NQcm90b2NvbCgpO1xuICAgICAgaXNNSlNPTldQID0gZHJpdmVyLmlzTWpzb253cFByb3RvY29sKCk7XG5cbiAgICAgIC8vIElmIGBleGVjdXRlQ29tbWFuZGAgd2FzIG92ZXJyaWRkZW4gYW5kIHRoZSBtZXRob2QgcmV0dXJucyBhbiBvYmplY3RcbiAgICAgIC8vIHdpdGggYSBwcm90b2NvbCBhbmQgdmFsdWUvZXJyb3IgcHJvcGVydHksIHJlLWFzc2lnbiB0aGUgcHJvdG9jb2xcbiAgICAgIGNvbnN0IHBhcnNlZERyaXZlclJlcyA9IHBhcnNlUHJvdG9jb2woZHJpdmVyUmVzKTtcbiAgICAgIGlmIChwYXJzZWREcml2ZXJSZXMpIHtcbiAgICAgICAgaXNXM0MgPSBwYXJzZWREcml2ZXJSZXMuaXNXM0M7XG4gICAgICAgIGlzTUpTT05XUCA9IHBhcnNlZERyaXZlclJlcy5pc01KU09OV1A7XG4gICAgICAgIGlmIChwYXJzZWREcml2ZXJSZXMuZXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBwYXJzZWREcml2ZXJSZXMuZXJyb3I7XG4gICAgICAgIH1cbiAgICAgICAgZHJpdmVyUmVzID0gcGFyc2VkRHJpdmVyUmVzLnZhbHVlO1xuICAgICAgfVxuXG4gICAgICAvLyBVc2UgdGhlIGxvZ2dlciB0aGF0J3Mgc3BlY2lmaWMgdG8gdGhpcyByZXNwb25zZVxuICAgICAgY29uc3QgcHJvdG9jb2xMb2dnZXIgPSBpc1czQyA/IHczY0xvZyA6IG1qc29ud3BMb2c7XG5cbiAgICAgIC8vIHVucGFjayBjcmVhdGVTZXNzaW9uIHJlc3BvbnNlXG4gICAgICBpZiAoc3BlYy5jb21tYW5kID09PSAnY3JlYXRlU2Vzc2lvbicpIHtcbiAgICAgICAgbmV3U2Vzc2lvbklkID0gZHJpdmVyUmVzWzBdO1xuICAgICAgICBpZiAoaXNNSlNPTldQKSB7XG4gICAgICAgICAgZHJpdmVyUmVzID0gZHJpdmVyUmVzWzFdO1xuICAgICAgICB9IGVsc2UgaWYgKGlzVzNDKSB7XG4gICAgICAgICAgZHJpdmVyUmVzID0ge1xuICAgICAgICAgICAgY2FwYWJpbGl0aWVzOiBkcml2ZXJSZXNbMV0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgTUpTT05XUCBlbGVtZW50IGtleSBmb3JtYXQgKEVMRU1FTlQpIHdhcyBwcm92aWRlZCB0cmFuc2xhdGUgaXQgdG8gVzNDIGVsZW1lbnQga2V5IGZvcm1hdCAoZWxlbWVudC02MDY2LTExZTQtYTUyZS00ZjczNTQ2NmNlY2YpXG4gICAgICAvLyBhbmQgdmljZS12ZXJzYVxuICAgICAgaWYgKGRyaXZlclJlcykge1xuICAgICAgICBpZiAoaXNXM0MpIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSByZW5hbWVLZXkoZHJpdmVyUmVzLCBNSlNPTldQX0VMRU1FTlRfS0VZLCBXM0NfRUxFTUVOVF9LRVkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRyaXZlclJlcyA9IHJlbmFtZUtleShkcml2ZXJSZXMsIFczQ19FTEVNRU5UX0tFWSwgTUpTT05XUF9FTEVNRU5UX0tFWSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICAvLyBjb252ZXJ0IHVuZGVmaW5lZCB0byBudWxsLCBidXQgbGVhdmUgYWxsIG90aGVyIHZhbHVlcyB0aGUgc2FtZVxuICAgICAgaWYgKF8uaXNVbmRlZmluZWQoZHJpdmVyUmVzKSkge1xuICAgICAgICBkcml2ZXJSZXMgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICAvLyBkZWxldGUgc2hvdWxkIG5vdCByZXR1cm4gYW55dGhpbmcgZXZlbiBpZiBzdWNjZXNzZnVsXG4gICAgICBpZiAoc3BlYy5jb21tYW5kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICAgICAgcHJvdG9jb2xMb2dnZXIuZGVidWcoYFJlY2VpdmVkIHJlc3BvbnNlOiAke18udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoZHJpdmVyUmVzKSwge2xlbmd0aDogTE9HX09CSl9MRU5HVEh9KX1gKTtcbiAgICAgICAgcHJvdG9jb2xMb2dnZXIuZGVidWcoJ0J1dCBkZWxldGluZyBzZXNzaW9uLCBzbyBub3QgcmV0dXJuaW5nJyk7XG4gICAgICAgIGRyaXZlclJlcyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHRoZSBzdGF0dXMgaXMgbm90IDAsICB0aHJvdyB0aGUgYXBwcm9wcmlhdGUgZXJyb3IgZm9yIHN0YXR1cyBjb2RlLlxuICAgICAgaWYgKHV0aWwuaGFzVmFsdWUoZHJpdmVyUmVzKSkge1xuICAgICAgICBpZiAodXRpbC5oYXNWYWx1ZShkcml2ZXJSZXMuc3RhdHVzKSAmJiAhaXNOYU4oZHJpdmVyUmVzLnN0YXR1cykgJiYgcGFyc2VJbnQoZHJpdmVyUmVzLnN0YXR1cywgMTApICE9PSAwKSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3JGcm9tTUpTT05XUFN0YXR1c0NvZGUoZHJpdmVyUmVzLnN0YXR1cywgZHJpdmVyUmVzLnZhbHVlKTtcbiAgICAgICAgfSBlbHNlIGlmIChfLmlzUGxhaW5PYmplY3QoZHJpdmVyUmVzLnZhbHVlKSAmJiBkcml2ZXJSZXMudmFsdWUuZXJyb3IpIHtcbiAgICAgICAgICB0aHJvdyBlcnJvckZyb21XM0NKc29uQ29kZShkcml2ZXJSZXMudmFsdWUuZXJyb3IsIGRyaXZlclJlcy52YWx1ZS5tZXNzYWdlLCBkcml2ZXJSZXMudmFsdWUuc3RhY2t0cmFjZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gUmVzcG9uc2Ugc3RhdHVzIHNob3VsZCBiZSB0aGUgc3RhdHVzIHNldCBieSB0aGUgZHJpdmVyIHJlc3BvbnNlLlxuICAgICAgaWYgKCFpc1czQykge1xuICAgICAgICBodHRwUmVzQm9keS5zdGF0dXMgPSAoXy5pc05pbChkcml2ZXJSZXMpIHx8IF8uaXNVbmRlZmluZWQoZHJpdmVyUmVzLnN0YXR1cykpID8gSlNPTldQX1NVQ0NFU1NfU1RBVFVTX0NPREUgOiBkcml2ZXJSZXMuc3RhdHVzO1xuICAgICAgfVxuICAgICAgaHR0cFJlc0JvZHkudmFsdWUgPSBkcml2ZXJSZXM7XG4gICAgICBwcm90b2NvbExvZ2dlci5kZWJ1ZyhgUmVzcG9uZGluZyB0byBjbGllbnQgd2l0aCBkcml2ZXIuJHtzcGVjLmNvbW1hbmR9KCkgYCArXG4gICAgICAgICAgICAgICBgcmVzdWx0OiAke18udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoZHJpdmVyUmVzKSwge2xlbmd0aDogTE9HX09CSl9MRU5HVEh9KX1gKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIGlmIGFueXRoaW5nIGdvZXMgd3JvbmcsIGZpZ3VyZSBvdXQgd2hhdCBvdXIgcmVzcG9uc2Ugc2hvdWxkIGJlXG4gICAgICAvLyBiYXNlZCBvbiB0aGUgdHlwZSBvZiBlcnJvciB0aGF0IHdlIGVuY291bnRlcmVkXG4gICAgICBsZXQgYWN0dWFsRXJyID0gZXJyO1xuXG4gICAgICBpZiAoXy5pc1VuZGVmaW5lZChpc01KU09OV1ApKSB7XG4gICAgICAgIGlzTUpTT05XUCA9IGRyaXZlci5pc01qc29ud3BQcm90b2NvbCgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoXy5pc1VuZGVmaW5lZChpc1czQykpIHtcbiAgICAgICAgaXNXM0MgPSBkcml2ZXIuaXNXM0NQcm90b2NvbCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBVc2UgdGhlIGxvZ2dlciB0aGF0J3Mgc3BlY2lmaWMgdG8gdGhpcyByZXNwb25zZVxuICAgICAgY29uc3QgcHJvdG9jb2xMb2dnZXIgPSBpc1czQyA/IHczY0xvZyA6IG1qc29ud3BMb2c7XG5cbiAgICAgIHByb3RvY29sTG9nZ2VyLmVycm9yKGBFbmNvdW50ZXJlZCBpbnRlcm5hbCBlcnJvciBydW5uaW5nIGNvbW1hbmQ6ICAke0pTT04uc3RyaW5naWZ5KGVycil9ICR7ZXJyLnN0YWNrdHJhY2UgfHwgZXJyLnN0YWNrfWApO1xuICAgICAgaWYgKGlzRXJyb3JUeXBlKGVyciwgZXJyb3JzLlByb3h5UmVxdWVzdEVycm9yKSkge1xuICAgICAgICBhY3R1YWxFcnIgPSBlcnIuZ2V0QWN0dWFsRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzVzNDKSB7XG4gICAgICAgIFtodHRwU3RhdHVzLCBodHRwUmVzQm9keV0gPSBnZXRSZXNwb25zZUZvclczQ0Vycm9yKGFjdHVhbEVycik7XG4gICAgICB9IGVsc2UgaWYgKGlzTUpTT05XUCkge1xuICAgICAgICBbaHR0cFN0YXR1cywgaHR0cFJlc0JvZHldID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgaXQncyB1bmtub3duIHdoYXQgdGhlIHByb3RvY29sIGlzIChsaWtlIGlmIGl0J3MgYGdldFN0YXR1c2AgcHJpb3IgdG8gYGNyZWF0ZVNlc3Npb25gKSwgbWVyZ2UgdGhlIHJlc3BvbnNlc1xuICAgICAgICAvLyB0b2dldGhlciB0byBiZSBwcm90b2NvbC1hZ25vc3RpY1xuICAgICAgICBsZXQganNvbndwUmVzID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgICBsZXQgdzNjUmVzID0gZ2V0UmVzcG9uc2VGb3JXM0NFcnJvcihhY3R1YWxFcnIpO1xuXG4gICAgICAgIGh0dHBSZXNCb2R5ID0ge1xuICAgICAgICAgIC4uLmpzb253cFJlc1sxXSxcbiAgICAgICAgICAuLi53M2NSZXNbMV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVXNlIHRoZSBKU09OV1Agc3RhdHVzIGNvZGUgKHdoaWNoIGlzIHVzdWFsbHkgNTAwKVxuICAgICAgICBodHRwU3RhdHVzID0ganNvbndwUmVzWzBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRlY29kZSB0aGUgcmVzcG9uc2UsIHdoaWNoIGlzIGVpdGhlciBhIHN0cmluZyBvciBqc29uXG4gICAgaWYgKF8uaXNTdHJpbmcoaHR0cFJlc0JvZHkpKSB7XG4gICAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMpLnNlbmQoaHR0cFJlc0JvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobmV3U2Vzc2lvbklkKSB7XG4gICAgICAgIGlmIChpc1czQykge1xuICAgICAgICAgIGh0dHBSZXNCb2R5LnZhbHVlLnNlc3Npb25JZCA9IG5ld1Nlc3Npb25JZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBodHRwUmVzQm9keS5zZXNzaW9uSWQgPSBuZXdTZXNzaW9uSWQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0dHBSZXNCb2R5LnNlc3Npb25JZCA9IHJlcS5wYXJhbXMuc2Vzc2lvbklkIHx8IG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIERvbid0IGluY2x1ZGUgc2Vzc2lvbklkIGluIFczQyByZXNwb25zZXNcbiAgICAgIGlmIChpc1czQykge1xuICAgICAgICBkZWxldGUgaHR0cFJlc0JvZHkuc2Vzc2lvbklkO1xuICAgICAgfVxuICAgICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzKS5qc29uKGh0dHBSZXNCb2R5KTtcbiAgICB9XG4gIH07XG4gIC8vIGFkZCB0aGUgbWV0aG9kIHRvIHRoZSBhcHBcbiAgYXBwW21ldGhvZC50b0xvd2VyQ2FzZSgpXShwYXRoLCAocmVxLCByZXMpID0+IHtcbiAgICBCLnJlc29sdmUoYXN5bmNIYW5kbGVyKHJlcSwgcmVzKSkuZG9uZSgpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZHJpdmVyU2hvdWxkRG9Kd3BQcm94eSAoZHJpdmVyLCByZXEsIGNvbW1hbmQpIHtcbiAgLy8gZHJpdmVycyBuZWVkIHRvIGV4cGxpY2l0bHkgc2F5IHdoZW4gdGhlIHByb3h5IGlzIGFjdGl2ZVxuICBpZiAoIWRyaXZlci5wcm94eUFjdGl2ZShyZXEucGFyYW1zLnNlc3Npb25JZCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB3ZSBzaG91bGQgbmV2ZXIgcHJveHkgZGVsZXRlU2Vzc2lvbiBiZWNhdXNlIHdlIG5lZWQgdG8gZ2l2ZSB0aGUgY29udGFpbmluZ1xuICAvLyBkcml2ZXIgYW4gb3Bwb3J0dW5pdHkgdG8gY2xlYW4gaXRzZWxmIHVwXG4gIGlmIChjb21tYW5kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB2YWxpZGF0ZSBhdm9pZGFuY2Ugc2NoZW1hLCBhbmQgc2F5IHdlIHNob3VsZG4ndCBwcm94eSBpZiBhbnl0aGluZyBpbiB0aGVcbiAgLy8gYXZvaWQgbGlzdCBtYXRjaGVzIG91ciByZXFcbiAgaWYgKGRyaXZlci5wcm94eVJvdXRlSXNBdm9pZGVkKHJlcS5wYXJhbXMuc2Vzc2lvbklkLCByZXEubWV0aG9kLCByZXEub3JpZ2luYWxVcmwpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gaWYgaXQgbG9va3MgbGlrZSB3ZSBoYXZlIGFuIGltYWdlIGVsZW1lbnQgaW4gdGhlIHVybCAoYXMgYSByb3V0ZVxuICAvLyBwYXJhbWV0ZXIpLCBuZXZlciBwcm94eS4gSnVzdCBsb29rIGZvciBvdXIgaW1hZ2UgZWxlbWVudCBwcmVmaXggaW4gYWxsb3dlZFxuICAvLyBwb3NpdGlvbnMgKGVpdGhlciBhZnRlciBhbiAnZWxlbWVudCcgb3IgJ3NjcmVlbnNob3QnIHBhdGggc2VnbWVudCksIGFuZFxuICAvLyBlbnN1cmUgdGhlIHByZWZpeCBpcyBmb2xsb3dlZCBieSBzb21ldGhpbmdcbiAgaWYgKElNR19FTF9VUkxfUkUudGVzdChyZXEub3JpZ2luYWxVcmwpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBhbHNvIGlmIGl0IGxvb2tzIGxpa2Ugd2UgaGF2ZSBhbiBpbWFnZSBlbGVtZW50IGluIHRoZSByZXF1ZXN0IGJvZHkgKGFzXG4gIC8vIGEgSlNPTiBwYXJhbWV0ZXIpLCBuZXZlciBwcm94eS4gQmFzaWNhbGx5IGNoZWNrIGFnYWluc3QgYSByZWdleHAgb2YgdGhlXG4gIC8vIGpzb24gc3RyaW5nIG9mIHRoZSBib2R5LCB3aGVyZSB3ZSBrbm93IHdoYXQgdGhlIGZvcm0gb2YgYW4gaW1hZ2UgZWxlbWVudFxuICAvLyBtdXN0IGJlXG4gIGNvbnN0IHN0cmluZ0JvZHkgPSBKU09OLnN0cmluZ2lmeShyZXEuYm9keSk7XG4gIGlmIChzdHJpbmdCb2R5ICYmIElNR19FTF9CT0RZX1JFLnRlc3Qoc3RyaW5nQm9keSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZG9Kd3BQcm94eSAoZHJpdmVyLCByZXEsIHJlcykge1xuICBnZXRMb2dCeVByb3RvY29sKGRyaXZlcikuaW5mbygnRHJpdmVyIHByb3h5IGFjdGl2ZSwgcGFzc2luZyByZXF1ZXN0IG9uIHZpYSBIVFRQIHByb3h5Jyk7XG5cbiAgLy8gY2hlY2sgdGhhdCB0aGUgaW5uZXIgZHJpdmVyIGhhcyBhIHByb3h5IGZ1bmN0aW9uXG4gIGlmICghZHJpdmVyLmNhblByb3h5KHJlcS5wYXJhbXMuc2Vzc2lvbklkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVHJ5aW5nIHRvIHByb3h5IHRvIGEgSlNPTldQIHNlcnZlciBidXQgZHJpdmVyIGlzIHVuYWJsZSB0byBwcm94eScpO1xuICB9XG4gIHRyeSB7XG4gICAgY29uc3QgcHJveGllZFJlcyA9IGF3YWl0IGRyaXZlci5leGVjdXRlQ29tbWFuZCgncHJveHlSZXFSZXMnLCByZXEsIHJlcywgcmVxLnBhcmFtcy5zZXNzaW9uSWQpO1xuICAgIGlmIChwcm94aWVkUmVzICYmIHByb3hpZWRSZXMuZXJyb3IpIHRocm93IHByb3hpZWRSZXMuZXJyb3I7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgY3VybHlcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgaWYgKGlzRXJyb3JUeXBlKGVyciwgZXJyb3JzLlByb3h5UmVxdWVzdEVycm9yKSkge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwcm94eS4gUHJveHkgZXJyb3I6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgYSBkcml2ZXIgY29tbWFuZCByZXNwb25kIGFuZCBzZWUgaWYgdGhlIHByb3RvY29sIGFuZCB2YWx1ZSB3YXMgcGFzc2VkIGluXG4gKiBAcGFyYW0ge09iamVjdH0gZHJpdmVyUmVzIFJlc3BvbnNlIHJldHVybmVkIGJ5IGBleGVjdXRlQ29tbWFuZGAgaW4gYW4gaW5uZXIgZHJpdmVyXG4gKiBAcmV0dXJucyB7P09iamVjdH0gT2JqZWN0IG9mIHRoZSBmb3JtIHtpc1czQywgaXNNSlNPTldQLCB2YWx1ZXxlcnJvcn0gb3IgbnVsbCBpZiBpdCBpc24ndCBwYXJzYWJsZVxuICovXG5mdW5jdGlvbiBwYXJzZVByb3RvY29sIChkcml2ZXJSZXMpIHtcbiAgaWYgKCFfLmlzUGxhaW5PYmplY3QoZHJpdmVyUmVzKSB8fCAhXy5pc1N0cmluZyhkcml2ZXJSZXMucHJvdG9jb2wpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBsZXQgaXNXM0MgPSBkcml2ZXJSZXMucHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQztcbiAgbGV0IGlzTUpTT05XUCA9IGRyaXZlclJlcy5wcm90b2NvbCA9PT0gQmFzZURyaXZlci5EUklWRVJfUFJPVE9DT0wuTUpTT05XUDtcblxuICBpZiAoXy5oYXMoZHJpdmVyUmVzLCAndmFsdWUnKSkge1xuICAgIHJldHVybiB7aXNXM0MsIGlzTUpTT05XUCwgdmFsdWU6IGRyaXZlclJlcy52YWx1ZX07XG4gIH1cblxuICBpZiAoXy5pc0Vycm9yKGRyaXZlclJlcy5lcnJvcikpIHtcbiAgICByZXR1cm4ge2lzVzNDLCBpc01KU09OV1AsIGVycm9yOiBkcml2ZXJSZXMuZXJyb3J9O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cblxuZXhwb3J0IHsgUHJvdG9jb2wsIHJvdXRlQ29uZmlndXJpbmdGdW5jdGlvbiwgaXNTZXNzaW9uQ29tbWFuZCxcbiAgICAgICAgIE1KU09OV1BfRUxFTUVOVF9LRVksIFczQ19FTEVNRU5UX0tFWSwgSU1BR0VfRUxFTUVOVF9QUkVGSVgsIHBhcnNlUHJvdG9jb2wsXG4gICAgICAgICBkcml2ZXJTaG91bGREb0p3cFByb3h5IH07XG4iXSwic291cmNlUm9vdCI6Ii4uLy4uLy4uIn0=
