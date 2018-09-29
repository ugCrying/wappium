"use strict";
/* 用于替换
\node_modules\appium-base-driver\build\lib\protocol
中同名文件
基于 appium-base-driver@3.6.3
共5处修改
*/
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

var _lruCache = require("lru-cache");

var _lruCache2 = _interopRequireDefault(_lruCache);

const testwa = require("../../../../../lib/testwa");

var mjsonwpLog = _appiumSupport.logger.getLogger("MJSONWP");
var w3cLog = _appiumSupport.logger.getLogger("W3C");
var genericProtocolLog = _appiumSupport.logger.getLogger("GENERIC");

var JSONWP_SUCCESS_STATUS_CODE = 0;
// TODO: Make this value configurable as a server side capability
var LOG_OBJ_LENGTH = 1024; // MAX LENGTH Logged to file / console

var MJSONWP_ELEMENT_KEY = "ELEMENT";
var W3C_ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
var IMAGE_ELEMENT_PREFIX = "appium-image-element-";

var CREATE_SESSION_COMMAND = "createSession";
var DELETE_SESSION_COMMAND = "deleteSession";

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

function getLogByProtocol(protocol) {
  switch (protocol) {
    case _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C:
      return w3cLog;
    case _basedriverDriver2["default"].DRIVER_PROTOCOL.MJSONWP:
      return mjsonwpLog;
    default:
      return genericProtocolLog;
  }
}

// This cache is useful when a session gets terminated
// and removed from the sessions list in the umbrella driver,
// but the client still tries to send a command to this session id.
// So we know how to properly wrap the error message for it
var PROTOCOLS_MAPPING_CACHE = new _lruCache2["default"]({
  max: 100
});

function cacheProtocolValue(value, sessionId) {
  if (sessionId && value) {
    PROTOCOLS_MAPPING_CACHE.set(sessionId, value);
  }
  return value;
}

function extractProtocol(driver) {
  var sessionId =
    arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

  var dstDriver = _lodash2["default"].isFunction(driver.driverForSession)
    ? driver.driverForSession(sessionId)
    : driver;
  if (dstDriver === driver) {
    // Shortcircuit if the driver instance is not an umbrella driver
    // or it is Fake driver instance, where `driver.driverForSession`
    // always returns self instance
    return driver.protocol;
  }

  // Extract the protocol for the current session if the given driver is the umbrella one
  return dstDriver
    ? dstDriver.protocol
    : PROTOCOLS_MAPPING_CACHE.get(sessionId);
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
      currentProtocol,
      args,
      driverRes,
      actualErr,
      errMsg,
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
              currentProtocol = extractProtocol(driver, req.params.sessionId);
              context$2$0.prev = 5;

              if (!(isSessCmd && !driver.sessionExists(req.params.sessionId))) {
                context$2$0.next = 8;
                break;
              }

              throw new _errors.errors.NoSuchDriverError();

            case 8:
              if (
                !(
                  isSessCmd && driverShouldDoJwpProxy(driver, req, spec.command)
                )
              ) {
                context$2$0.next = 12;
                break;
              }

              context$2$0.next = 11;
              return _regeneratorRuntime.awrap(doJwpProxy(driver, req, res));

            case 11:
              return context$2$0.abrupt("return");

            case 12:
              if (spec.command) {
                context$2$0.next = 14;
                break;
              }

              throw new _errors.errors.NotImplementedError();

            case 14:
              // wrap params if necessary
              if (spec.payloadParams && spec.payloadParams.wrap) {
                jsonObj = wrapParams(spec.payloadParams, jsonObj);
              }

              // unwrap params if necessary
              if (spec.payloadParams && spec.payloadParams.unwrap) {
                jsonObj = unwrapParams(spec.payloadParams, jsonObj);
              }

              if (spec.command === CREATE_SESSION_COMMAND) {
                // try to determine protocol by session creation args, so we can throw a
                // properly formatted error if arguments validation fails
                currentProtocol = _basedriverDriver2[
                  "default"
                ].determineProtocol.apply(
                  _basedriverDriver2["default"],
                  _toConsumableArray(
                    makeArgs(req.params, jsonObj, spec.payloadParams || {})
                  )
                );
              }

              // ensure that the json payload conforms to the spec
              checkParams(spec.payloadParams, jsonObj, currentProtocol);

              // turn the command and json payload into an argument list for
              // the driver methods
              args = makeArgs(
                req.params,
                jsonObj,
                spec.payloadParams || {},
                currentProtocol
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
              getLogByProtocol(currentProtocol).debug(
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
                context$2$0.next = 28;
                break;
              }

              context$2$0.next = 25;
              return _regeneratorRuntime.awrap(
                driver.executeCommand.apply(
                  driver,
                  [spec.command].concat(_toConsumableArray(args))
                )
              );

            case 25:
              driverRes = context$2$0.sent;
              context$2$0.next = 31;
              break;

            case 28:
              context$2$0.next = 30;
              return _regeneratorRuntime.awrap(
                driver.execute.apply(
                  driver,
                  [spec.command].concat(_toConsumableArray(args))
                )
              );

            case 30:
              driverRes = context$2$0.sent;

            case 31:
              // Get the protocol after executeCommand
              currentProtocol =
                extractProtocol(driver, req.params.sessionId) ||
                currentProtocol;

              // If `executeCommand` was overridden and the method returns an object
              // with a protocol and value/error property, re-assign the protocol

              if (
                !(
                  _lodash2["default"].isPlainObject(driverRes) &&
                  _lodash2["default"].has(driverRes, "protocol")
                )
              ) {
                context$2$0.next = 37;
                break;
              }

              currentProtocol = driverRes.protocol || currentProtocol;

              if (!driverRes.error) {
                context$2$0.next = 36;
                break;
              }

              throw driverRes.error;

            case 36:
              driverRes = driverRes.value;

            case 37:
              // unpack createSession response
              if (spec.command === CREATE_SESSION_COMMAND) {
                newSessionId = driverRes[0];
                cacheProtocolValue(currentProtocol, newSessionId);
                getLogByProtocol(currentProtocol).debug(
                  "Cached the protocol value '" +
                    currentProtocol +
                    "' for the new session " +
                    newSessionId
                );
                if (
                  currentProtocol ===
                  _basedriverDriver2["default"].DRIVER_PROTOCOL.MJSONWP
                ) {
                  driverRes = driverRes[1];
                } else if (
                  currentProtocol ===
                  _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
                ) {
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
                if (
                  currentProtocol ===
                  _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
                ) {
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
              if (spec.command === DELETE_SESSION_COMMAND) {
                getLogByProtocol(currentProtocol).debug(
                  "Received response: " +
                    _lodash2["default"].truncate(JSON.stringify(driverRes), {
                      length: LOG_OBJ_LENGTH
                    })
                );
                getLogByProtocol(currentProtocol).debug(
                  "But deleting session, so not returning"
                );
                driverRes = null;
              }

              // if the status is not 0,  throw the appropriate error for status code.

              if (!_appiumSupport.util.hasValue(driverRes)) {
                context$2$0.next = 48;
                break;
              }

              if (
                !(
                  _appiumSupport.util.hasValue(driverRes.status) &&
                  !isNaN(driverRes.status) &&
                  parseInt(driverRes.status, 10) !== 0
                )
              ) {
                context$2$0.next = 46;
                break;
              }

              throw (0, _errors.errorFromMJSONWPStatusCode)(
                driverRes.status,
                driverRes.value
              );

            case 46:
              if (
                !(
                  _lodash2["default"].isPlainObject(driverRes.value) &&
                  driverRes.value.error
                )
              ) {
                context$2$0.next = 48;
                break;
              }

              throw (0, _errors.errorFromW3CJsonCode)(
                driverRes.value.error,
                driverRes.value.message,
                driverRes.value.stacktrace
              );

            case 48:
              // Response status should be the status set by the driver response.
              if (
                currentProtocol !==
                _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
              ) {
                httpResBody.status =
                  _lodash2["default"].isNil(driverRes) ||
                  _lodash2["default"].isUndefined(driverRes.status)
                    ? JSONWP_SUCCESS_STATUS_CODE
                    : driverRes.status;
              }
              httpResBody.value = driverRes;
              getLogByProtocol(currentProtocol).debug(
                "Responding to client with driver." +
                  spec.command +
                  "() " +
                  ("result: " +
                    _lodash2["default"].truncate(JSON.stringify(driverRes), {
                      length: LOG_OBJ_LENGTH
                    }))
              );
              context$2$0.next = 62;
              break;

            case 53:
              context$2$0.prev = 53;
              context$2$0.t0 = context$2$0["catch"](5);
              actualErr = context$2$0.t0;

              currentProtocol =
                currentProtocol ||
                extractProtocol(driver, req.params.sessionId || newSessionId);

              errMsg = context$2$0.t0.stacktrace || context$2$0.t0.stack;

              if (!errMsg.includes(context$2$0.t0.message)) {
                // if the message has more information, add it. but often the message
                // is the first part of the stack trace
                errMsg = context$2$0.t0.message + " " + errMsg;
              }
              getLogByProtocol(currentProtocol).debug(
                "Encountered internal error running command: " + errMsg
              );
              if (
                (0, _errors.isErrorType)(
                  context$2$0.t0,
                  _errors.errors.ProxyRequestError
                )
              ) {
                actualErr = context$2$0.t0.getActualError();
              }

              if (
                currentProtocol ===
                _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
              ) {
                _getResponseForW3CError = (0, _errors.getResponseForW3CError)(
                  actualErr
                );
                _getResponseForW3CError2 = _slicedToArray(
                  _getResponseForW3CError,
                  2
                );
                httpStatus = _getResponseForW3CError2[0];
                httpResBody = _getResponseForW3CError2[1];
              } else if (
                currentProtocol ===
                _basedriverDriver2["default"].DRIVER_PROTOCOL.MJSONWP
              ) {
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

            case 62:
              // decode the response, which is either a string or json
              if (_lodash2["default"].isString(httpResBody)) {
                res.status(httpStatus).send(httpResBody);
              } else {
                if (newSessionId) {
                  if (
                    currentProtocol ===
                    _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
                  ) {
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
                if (
                  currentProtocol ===
                  _basedriverDriver2["default"].DRIVER_PROTOCOL.W3C
                ) {
                  delete httpResBody.sessionId;
                }
                res.status(httpStatus).json(httpResBody);
              }

            case 63:
            case "end":
              return context$2$0.stop();
          }
      },
      null,
      _this,
      [[5, 53]]
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
  var log, proxiedRes;
  return _regeneratorRuntime.async(
    function doJwpProxy$(context$1$0) {
      while (1)
        switch ((context$1$0.prev = context$1$0.next)) {
          case 0:
            log = getLogByProtocol(
              extractProtocol(driver, req.params.sessionId)
            );

            log.info("Driver proxy active, passing request on via HTTP proxy");

            // check that the inner driver has a proxy function

            if (driver.canProxy(req.params.sessionId)) {
              context$1$0.next = 4;
              break;
            }

            throw new Error(
              "Trying to proxy to a JSONWP server but driver is unable to proxy"
            );

          case 4:
            context$1$0.prev = 4;
            context$1$0.next = 7;
            return _regeneratorRuntime.awrap(
              driver.executeCommand(
                "proxyReqRes",
                req,
                res,
                req.params.sessionId
              )
            );

          case 7:
            proxiedRes = context$1$0.sent;

            if (!(proxiedRes && proxiedRes.error)) {
              context$1$0.next = 10;
              break;
            }

            throw proxiedRes.error;

          case 10:
            context$1$0.next = 19;
            break;

          case 12:
            context$1$0.prev = 12;
            context$1$0.t0 = context$1$0["catch"](4);

            if (
              !(0, _errors.isErrorType)(
                context$1$0.t0,
                _errors.errors.ProxyRequestError
              )
            ) {
              context$1$0.next = 18;
              break;
            }

            throw context$1$0.t0;

          case 18:
            throw new Error(
              "Could not proxy. Proxy error: " + context$1$0.t0.message
            );

          case 19:
          case "end":
            return context$1$0.stop();
        }
    },
    null,
    this,
    [[4, 12]]
  );
}

exports.Protocol = Protocol;
exports.routeConfiguringFunction = routeConfiguringFunction;
exports.isSessionCommand = isSessionCommand;
exports.MJSONWP_ELEMENT_KEY = MJSONWP_ELEMENT_KEY;
exports.W3C_ELEMENT_KEY = W3C_ELEMENT_KEY;
exports.IMAGE_ELEMENT_PREFIX = IMAGE_ELEMENT_PREFIX;
exports.driverShouldDoJwpProxy = driverShouldDoJwpProxy;

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

// if anything goes wrong, figure out what our response should be
// based on the type of error that we encountered

// If it's unknown what the protocol is (like if it's `getStatus` prior to `createSession`), merge the responses
// together to be protocol-agnostic
// eslint-disable-line curly
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9wcm90b2NvbC9wcm90b2NvbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztzQkFBYyxRQUFROzs7OzZCQUNPLGdCQUFnQjs7MEJBQ2xCLGNBQWM7O3NCQUV5QixVQUFVOztzQkFDekIsVUFBVTs7aUNBQ25DLHVCQUF1Qjs7d0JBQ25DLFVBQVU7Ozs7Z0NBQ0Qsc0JBQXNCOzs7O3dCQUM3QixXQUFXOzs7O0FBRTNCLElBQU0sVUFBVSxHQUFHLHNCQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQyxJQUFNLE1BQU0sR0FBRyxzQkFBTyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdkMsSUFBTSxrQkFBa0IsR0FBRyxzQkFBTyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7O0FBRXZELElBQU0sMEJBQTBCLEdBQUcsQ0FBQyxDQUFDOztBQUVyQyxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7O0FBRTVCLElBQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBQ3RDLElBQU0sZUFBZSxHQUFHLHFDQUFxQyxDQUFDO0FBQzlELElBQU0sb0JBQW9CLEdBQUcsdUJBQXVCLENBQUM7O0FBRXJELElBQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDO0FBQy9DLElBQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDOztBQUUvQyxJQUFNLGNBQWMsR0FBRyxJQUFJLE1BQU0sQ0FDL0IsT0FBSyxlQUFlLFNBQUksbUJBQW1CLG9CQUN2QyxvQkFBb0IsWUFBUSxDQUNqQyxDQUFDO0FBQ0YsSUFBTSxhQUFhLEdBQUcsSUFBSSxNQUFNLENBQzlCLGlDQUNJLG9CQUFvQixXQUFPLENBQ2hDLENBQUM7O0lBRUksUUFBUSxZQUFSLFFBQVE7d0JBQVIsUUFBUTs7O0FBRWQsU0FBUyxnQkFBZ0IsQ0FBRSxRQUFRLEVBQUU7QUFDbkMsVUFBUSxRQUFRO0FBQ2QsU0FBSyw4QkFBVyxlQUFlLENBQUMsR0FBRztBQUNqQyxhQUFPLE1BQU0s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QUUsd0JBQXdCLEdBQXhCLHdCQUF3QjtRQUFFLGdCQUFnQixHQUFoQixnQkFBZ0I7UUFDcEQsbUJBQW1CLEdBQW5CLG1CQUFtQjtRQUFFLGVBQWUsR0FBZixlQUFlO1FBQUUsb0JBQW9CLEdBQXBCLG9CQUFvQjtRQUMxRCxzQkFBc0IsR0FBdEIsc0JBQXNCIiwiZmlsZSI6ImxpYi9wcm90b2NvbC9wcm90b2NvbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgeyBsb2dnZXIsIHV0aWwgfSBmcm9tICdhcHBpdW0tc3VwcG9ydCc7XG5pbXBvcnQgeyB2YWxpZGF0b3JzIH0gZnJvbSAnLi92YWxpZGF0b3JzJztcbmltcG9ydCB7IGVycm9ycywgaXNFcnJvclR5cGUsIGVycm9yRnJvbU1KU09OV1BTdGF0dXNDb2RlLCBlcnJvckZyb21XM0NKc29uQ29kZSxcbiAgICAgICAgIGdldFJlc3BvbnNlRm9yVzNDRXJyb3IsIGdldFJlc3BvbnNlRm9ySnNvbndwRXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgeyBNRVRIT0RfTUFQLCBOT19TRVNTSU9OX0lEX0NPTU1BTkRTIH0gZnJvbSAnLi9yb3V0ZXMnO1xuaW1wb3J0IHsgcmVuYW1lS2V5IH0gZnJvbSAnLi4vYmFzZWRyaXZlci9oZWxwZXJzJztcbmltcG9ydCBCIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCBCYXNlRHJpdmVyIGZyb20gJy4uL2Jhc2Vkcml2ZXIvZHJpdmVyJztcbmltcG9ydCBMUlUgZnJvbSAnbHJ1LWNhY2hlJztcblxuY29uc3QgbWpzb253cExvZyA9IGxvZ2dlci5nZXRMb2dnZXIoJ01KU09OV1AnKTtcbmNvbnN0IHczY0xvZyA9IGxvZ2dlci5nZXRMb2dnZXIoJ1czQycpO1xuY29uc3QgZ2VuZXJpY1Byb3RvY29sTG9nID0gbG9nZ2VyLmdldExvZ2dlcignR0VORVJJQycpO1xuXG5jb25zdCBKU09OV1BfU1VDQ0VTU19TVEFUVVNfQ09ERSA9IDA7XG4vLyBUT0RPOiBNYWtlIHRoaXMgdmFsdWUgY29uZmlndXJhYmxlIGFzIGEgc2VydmVyIHNpZGUgY2FwYWJpbGl0eVxuY29uc3QgTE9HX09CSl9MRU5HVEggPSAxMDI0OyAvLyBNQVggTEVOR1RIIExvZ2dlZCB0byBmaWxlIC8gY29uc29sZVxuXG5jb25zdCBNSlNPTldQX0VMRU1FTlRfS0VZID0gJ0VMRU1FTlQnO1xuY29uc3QgVzNDX0VMRU1FTlRfS0VZID0gJ2VsZW1lbnQtNjA2Ni0xMWU0LWE1MmUtNGY3MzU0NjZjZWNmJztcbmNvbnN0IElNQUdFX0VMRU1FTlRfUFJFRklYID0gJ2FwcGl1bS1pbWFnZS1lbGVtZW50LSc7XG5cbmNvbnN0IENSRUFURV9TRVNTSU9OX0NPTU1BTkQgPSAnY3JlYXRlU2Vzc2lvbic7XG5jb25zdCBERUxFVEVfU0VTU0lPTl9DT01NQU5EID0gJ2RlbGV0ZVNlc3Npb24nO1xuXG5jb25zdCBJTUdfRUxfQk9EWV9SRSA9IG5ldyBSZWdFeHAoXG4gIGBcIigke1czQ19FTEVNRU5UX0tFWX18JHtNSlNPTldQX0VMRU1FTlRfS0VZfSlcIjpcXHMqYCArXG4gIGBcIiR7SU1BR0VfRUxFTUVOVF9QUkVGSVh9W15cIl0rXCJgXG4pO1xuY29uc3QgSU1HX0VMX1VSTF9SRSA9IG5ldyBSZWdFeHAoXG4gIGAvKGVsZW1lbnR8c2NyZWVuc2hvdClgICtcbiAgYC8ke0lNQUdFX0VMRU1FTlRfUFJFRklYfVteL10rYFxuKTtcblxuY2xhc3MgUHJvdG9jb2wge31cblxuZnVuY3Rpb24gZ2V0TG9nQnlQcm90b2NvbCAocHJvdG9jb2wpIHtcbiAgc3dpdGNoIChwcm90b2NvbCkge1xuICAgIGNhc2UgQmFzZURyaXZlci5EUklWRVJfUFJPVE9DT0wuVzNDOlxuICAgICAgcmV0dXJuIHczY0xvZztcbiAgICBjYXNlIEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLk1KU09OV1A6XG4gICAgICByZXR1cm4gbWpzb253cExvZztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGdlbmVyaWNQcm90b2NvbExvZztcbiAgfVxufVxuXG4vLyBUaGlzIGNhY2hlIGlzIHVzZWZ1bCB3aGVuIGEgc2Vzc2lvbiBnZXRzIHRlcm1pbmF0ZWRcbi8vIGFuZCByZW1vdmVkIGZyb20gdGhlIHNlc3Npb25zIGxpc3QgaW4gdGhlIHVtYnJlbGxhIGRyaXZlcixcbi8vIGJ1dCB0aGUgY2xpZW50IHN0aWxsIHRyaWVzIHRvIHNlbmQgYSBjb21tYW5kIHRvIHRoaXMgc2Vzc2lvbiBpZC5cbi8vIFNvIHdlIGtub3cgaG93IHRvIHByb3Blcmx5IHdyYXAgdGhlIGVycm9yIG1lc3NhZ2UgZm9yIGl0XG5jb25zdCBQUk9UT0NPTFNfTUFQUElOR19DQUNIRSA9IG5ldyBMUlUoe1xuICBtYXg6IDEwMCxcbn0pO1xuXG5mdW5jdGlvbiBjYWNoZVByb3RvY29sVmFsdWUgKHZhbHVlLCBzZXNzaW9uSWQpIHtcbiAgaWYgKHNlc3Npb25JZCAmJiB2YWx1ZSkge1xuICAgIFBST1RPQ09MU19NQVBQSU5HX0NBQ0hFLnNldChzZXNzaW9uSWQsIHZhbHVlKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RQcm90b2NvbCAoZHJpdmVyLCBzZXNzaW9uSWQgPSBudWxsKSB7XG4gIGNvbnN0IGRzdERyaXZlciA9IF8uaXNGdW5jdGlvbihkcml2ZXIuZHJpdmVyRm9yU2Vzc2lvbilcbiAgICA/IGRyaXZlci5kcml2ZXJGb3JTZXNzaW9uKHNlc3Npb25JZClcbiAgICA6IGRyaXZlcjtcbiAgaWYgKGRzdERyaXZlciA9PT0gZHJpdmVyKSB7XG4gICAgLy8gU2hvcnRjaXJjdWl0IGlmIHRoZSBkcml2ZXIgaW5zdGFuY2UgaXMgbm90IGFuIHVtYnJlbGxhIGRyaXZlclxuICAgIC8vIG9yIGl0IGlzIEZha2UgZHJpdmVyIGluc3RhbmNlLCB3aGVyZSBgZHJpdmVyLmRyaXZlckZvclNlc3Npb25gXG4gICAgLy8gYWx3YXlzIHJldHVybnMgc2VsZiBpbnN0YW5jZVxuICAgIHJldHVybiBkcml2ZXIucHJvdG9jb2w7XG4gIH1cblxuICAvLyBFeHRyYWN0IHRoZSBwcm90b2NvbCBmb3IgdGhlIGN1cnJlbnQgc2Vzc2lvbiBpZiB0aGUgZ2l2ZW4gZHJpdmVyIGlzIHRoZSB1bWJyZWxsYSBvbmVcbiAgcmV0dXJuIGRzdERyaXZlciA/IGRzdERyaXZlci5wcm90b2NvbCA6IFBST1RPQ09MU19NQVBQSU5HX0NBQ0hFLmdldChzZXNzaW9uSWQpO1xufVxuXG5mdW5jdGlvbiBpc1Nlc3Npb25Db21tYW5kIChjb21tYW5kKSB7XG4gIHJldHVybiAhXy5pbmNsdWRlcyhOT19TRVNTSU9OX0lEX0NPTU1BTkRTLCBjb21tYW5kKTtcbn1cblxuZnVuY3Rpb24gd3JhcFBhcmFtcyAocGFyYW1TZXRzLCBqc29uT2JqKSB7XG4gIC8qIFRoZXJlIGFyZSBjb21tYW5kcyBsaWtlIHBlcmZvcm1Ub3VjaCB3aGljaCB0YWtlIGEgc2luZ2xlIHBhcmFtZXRlciAocHJpbWl0aXZlIHR5cGUgb3IgYXJyYXkpLlxuICAgKiBTb21lIGRyaXZlcnMgY2hvb3NlIHRvIHBhc3MgdGhpcyBwYXJhbWV0ZXIgYXMgYSB2YWx1ZSAoZWcuIFthY3Rpb24xLCBhY3Rpb24yLi4uXSkgd2hpbGUgb3RoZXJzIHRvXG4gICAqIHdyYXAgaXQgd2l0aGluIGFuIG9iamVjdChlZycge2dlc3R1cmU6ICBbYWN0aW9uMSwgYWN0aW9uMi4uLl19KSwgd2hpY2ggbWFrZXMgaXQgaGFyZCB0byB2YWxpZGF0ZS5cbiAgICogVGhlIHdyYXAgb3B0aW9uIGluIHRoZSBzcGVjIGVuZm9yY2Ugd3JhcHBpbmcgYmVmb3JlIHZhbGlkYXRpb24sIHNvIHRoYXQgYWxsIHBhcmFtcyBhcmUgd3JhcHBlZCBhdFxuICAgKiB0aGUgdGltZSB0aGV5IGFyZSB2YWxpZGF0ZWQgYW5kIGxhdGVyIHBhc3NlZCB0byB0aGUgY29tbWFuZHMuXG4gICAqL1xuICBsZXQgcmVzID0ganNvbk9iajtcbiAgaWYgKF8uaXNBcnJheShqc29uT2JqKSB8fCAhXy5pc09iamVjdChqc29uT2JqKSkge1xuICAgIHJlcyA9IHt9O1xuICAgIHJlc1twYXJhbVNldHMud3JhcF0gPSBqc29uT2JqO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIHVud3JhcFBhcmFtcyAocGFyYW1TZXRzLCBqc29uT2JqKSB7XG4gIC8qIFRoZXJlIGFyZSBjb21tYW5kcyBsaWtlIHNldE5ldHdvcmtDb25uZWN0aW9uIHdoaWNoIHNlbmQgcGFyYW1ldGVycyB3cmFwcGVkIGluc2lkZSBhIGtleSBzdWNoIGFzXG4gICAqIFwicGFyYW1ldGVyc1wiLiBUaGlzIGZ1bmN0aW9uIHVud3JhcHMgdGhlbSAoZWcuIHtcInBhcmFtZXRlcnNcIjoge1widHlwZVwiOiAxfX0gYmVjb21lcyB7XCJ0eXBlXCI6IDF9KS5cbiAgICovXG4gIGxldCByZXMgPSBqc29uT2JqO1xuICBpZiAoXy5pc09iamVjdChqc29uT2JqKSkge1xuICAgIC8vIHNvbWUgY2xpZW50cywgbGlrZSBydWJ5LCBkb24ndCB3cmFwXG4gICAgaWYgKGpzb25PYmpbcGFyYW1TZXRzLnVud3JhcF0pIHtcbiAgICAgIHJlcyA9IGpzb25PYmpbcGFyYW1TZXRzLnVud3JhcF07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNoZWNrUGFyYW1zIChwYXJhbVNldHMsIGpzb25PYmosIHByb3RvY29sKSB7XG4gIGxldCByZXF1aXJlZFBhcmFtcyA9IFtdO1xuICBsZXQgb3B0aW9uYWxQYXJhbXMgPSBbXTtcbiAgbGV0IHJlY2VpdmVkUGFyYW1zID0gXy5rZXlzKGpzb25PYmopO1xuXG4gIGlmIChwYXJhbVNldHMpIHtcbiAgICBpZiAocGFyYW1TZXRzLnJlcXVpcmVkKSB7XG4gICAgICAvLyB3ZSBtaWdodCBoYXZlIGFuIGFycmF5IG9mIHBhcmFtZXRlcnMsXG4gICAgICAvLyBvciBhbiBhcnJheSBvZiBhcnJheXMgb2YgcGFyYW1ldGVycywgc28gc3RhbmRhcmRpemVcbiAgICAgIGlmICghXy5pc0FycmF5KF8uZmlyc3QocGFyYW1TZXRzLnJlcXVpcmVkKSkpIHtcbiAgICAgICAgcmVxdWlyZWRQYXJhbXMgPSBbcGFyYW1TZXRzLnJlcXVpcmVkXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW1zID0gcGFyYW1TZXRzLnJlcXVpcmVkO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBvcHRpb25hbCBwYXJhbWV0ZXJzIGFyZSBqdXN0IGFuIGFycmF5XG4gICAgaWYgKHBhcmFtU2V0cy5vcHRpb25hbCkge1xuICAgICAgb3B0aW9uYWxQYXJhbXMgPSBwYXJhbVNldHMub3B0aW9uYWw7XG4gICAgfVxuXG4gICAgLy8gSWYgYSBmdW5jdGlvbiB3YXMgcHJvdmlkZWQgYXMgdGhlICd2YWxpZGF0ZScga2V5LCBpdCB3aWxsIGhlcmUgYmUgY2FsbGVkIHdpdGhcbiAgICAvLyBqc29uT2JqIGFzIHRoZSBwYXJhbS4gSWYgaXQgcmV0dXJucyBzb21ldGhpbmcgZmFsc3ksIHZlcmlmaWNhdGlvbiB3aWxsIGJlXG4gICAgLy8gY29uc2lkZXJlZCB0byBoYXZlIHBhc3NlZC4gSWYgaXQgcmV0dXJucyBzb21ldGhpbmcgZWxzZSwgdGhhdCB3aWxsIGJlIHRoZVxuICAgIC8vIGFyZ3VtZW50IHRvIGFuIGVycm9yIHdoaWNoIGlzIHRocm93biB0byB0aGUgdXNlclxuICAgIGlmIChwYXJhbVNldHMudmFsaWRhdGUpIHtcbiAgICAgIGxldCBtZXNzYWdlID0gcGFyYW1TZXRzLnZhbGlkYXRlKGpzb25PYmosIHByb3RvY29sKTtcbiAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuQmFkUGFyYW1ldGVyc0Vycm9yKG1lc3NhZ2UsIGpzb25PYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHdlIGhhdmUgbm8gcmVxdWlyZWQgcGFyYW1ldGVycywgYWxsIGlzIHdlbGxcbiAgaWYgKHJlcXVpcmVkUGFyYW1zLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIHNvbWUgY2xpZW50cyBwYXNzIGluIHRoZSBzZXNzaW9uIGlkIGluIHRoZSBwYXJhbXNcbiAgaWYgKG9wdGlvbmFsUGFyYW1zLmluZGV4T2YoJ3Nlc3Npb25JZCcpID09PSAtMSkge1xuICAgIG9wdGlvbmFsUGFyYW1zLnB1c2goJ3Nlc3Npb25JZCcpO1xuICB9XG5cbiAgLy8gc29tZSBjbGllbnRzIHBhc3MgaW4gYW4gZWxlbWVudCBpZCBpbiB0aGUgcGFyYW1zXG4gIGlmIChvcHRpb25hbFBhcmFtcy5pbmRleE9mKCdpZCcpID09PSAtMSkge1xuICAgIG9wdGlvbmFsUGFyYW1zLnB1c2goJ2lkJyk7XG4gIH1cblxuICAvLyBnbyB0aHJvdWdoIHRoZSByZXF1aXJlZCBwYXJhbWV0ZXJzIGFuZCBjaGVjayBhZ2FpbnN0IG91ciBhcmd1bWVudHNcbiAgZm9yIChsZXQgcGFyYW1zIG9mIHJlcXVpcmVkUGFyYW1zKSB7XG4gICAgaWYgKF8uZGlmZmVyZW5jZShyZWNlaXZlZFBhcmFtcywgcGFyYW1zLCBvcHRpb25hbFBhcmFtcykubGVuZ3RoID09PSAwICYmXG4gICAgICAgIF8uZGlmZmVyZW5jZShwYXJhbXMsIHJlY2VpdmVkUGFyYW1zKS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIHdlIGhhdmUgYSBzZXQgb2YgcGFyYW1ldGVycyB0aGF0IGlzIGNvcnJlY3RcbiAgICAgIC8vIHNvIHNob3J0LWNpcmN1aXRcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IGVycm9ycy5CYWRQYXJhbWV0ZXJzRXJyb3IocGFyYW1TZXRzLCByZWNlaXZlZFBhcmFtcyk7XG59XG5cbi8qXG4gKiBUaGlzIG1ldGhvZCB0YWtlcyAzIHBpZWNlcyBvZiBkYXRhOiByZXF1ZXN0IHBhcmFtZXRlcnMgKCdyZXF1ZXN0UGFyYW1zJyksXG4gKiBhIHJlcXVlc3QgSlNPTiBib2R5ICgnanNvbk9iaicpLCBhbmQgJ3BheWxvYWRQYXJhbXMnLCB3aGljaCBpcyB0aGUgc2VjdGlvblxuICogZnJvbSB0aGUgcm91dGUgZGVmaW5pdGlvbiBmb3IgYSBwYXJ0aWN1bGFyIGVuZHBvaW50IHdoaWNoIGhhcyBpbnN0cnVjdGlvbnNcbiAqIG9uIGhhbmRsaW5nIHBhcmFtZXRlcnMuIFRoaXMgbWV0aG9kIHJldHVybnMgYW4gYXJyYXkgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGxcbiAqIGJlIGFwcGxpZWQgdG8gYSBjb21tYW5kLlxuICovXG5mdW5jdGlvbiBtYWtlQXJncyAocmVxdWVzdFBhcmFtcywganNvbk9iaiwgcGF5bG9hZFBhcmFtcywgcHJvdG9jb2wpIHtcbiAgLy8gV2Ugd2FudCB0byBwYXNzIHRoZSBcInVybFwiIHBhcmFtZXRlcnMgdG8gdGhlIGNvbW1hbmRzIGluIHJldmVyc2Ugb3JkZXJcbiAgLy8gc2luY2UgdGhlIGNvbW1hbmQgd2lsbCBzb21ldGltZXMgd2FudCB0byBpZ25vcmUsIHNheSwgdGhlIHNlc3Npb25JZC5cbiAgLy8gVGhpcyBoYXMgdGhlIGVmZmVjdCBvZiBwdXR0aW5nIHNlc3Npb25JZCBsYXN0LCB3aGljaCBtZWFucyBpbiBKUyB3ZSBjYW5cbiAgLy8gb21pdCBpdCBmcm9tIHRoZSBmdW5jdGlvbiBzaWduYXR1cmUgaWYgd2UncmUgbm90IGdvaW5nIHRvIHVzZSBpdC5cbiAgbGV0IHVybFBhcmFtcyA9IF8ua2V5cyhyZXF1ZXN0UGFyYW1zKS5yZXZlcnNlKCk7XG5cbiAgLy8gSW4gdGhlIHNpbXBsZSBjYXNlLCB0aGUgcmVxdWlyZWQgcGFyYW1ldGVycyBhcmUgYSBiYXNpYyBhcnJheSBpblxuICAvLyBwYXlsb2FkUGFyYW1zLnJlcXVpcmVkLCBzbyBzdGFydCB0aGVyZS4gSXQncyBwb3NzaWJsZSB0aGF0IHRoZXJlIGFyZVxuICAvLyBtdWx0aXBsZSBvcHRpb25hbCBzZXRzIG9mIHJlcXVpcmVkIHBhcmFtcywgdGhvdWdoLCBzbyBoYW5kbGUgdGhhdCBjYXNlXG4gIC8vIHRvby5cbiAgbGV0IHJlcXVpcmVkUGFyYW1zID0gcGF5bG9hZFBhcmFtcy5yZXF1aXJlZDtcbiAgaWYgKF8uaXNBcnJheShfLmZpcnN0KHBheWxvYWRQYXJhbXMucmVxdWlyZWQpKSkge1xuICAgIC8vIElmIHRoZXJlIGFyZSBvcHRpb25hbCBzZXRzIG9mIHJlcXVpcmVkIHBhcmFtcywgdGhlbiB3ZSB3aWxsIGhhdmUgYW5cbiAgICAvLyBhcnJheSBvZiBhcnJheXMgaW4gcGF5bG9hZFBhcmFtcy5yZXF1aXJlZCwgc28gbG9vcCB0aHJvdWdoIGVhY2ggc2V0IGFuZFxuICAgIC8vIHBpY2sgdGhlIG9uZSB0aGF0IG1hdGNoZXMgd2hpY2ggSlNPTiBwYXJhbXMgd2VyZSBhY3R1YWxseSBzZW50LiBXZSd2ZVxuICAgIC8vIGFscmVhZHkgYmVlbiB0aHJvdWdoIHZhbGlkYXRpb24gc28gd2UncmUgZ3VhcmFudGVlZCB0byBmaW5kIGEgbWF0Y2guXG4gICAgbGV0IGtleXMgPSBfLmtleXMoanNvbk9iaik7XG4gICAgZm9yIChsZXQgcGFyYW1zIG9mIHBheWxvYWRQYXJhbXMucmVxdWlyZWQpIHtcbiAgICAgIGlmIChfLndpdGhvdXQocGFyYW1zLCAuLi5rZXlzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVxdWlyZWRQYXJhbXMgPSBwYXJhbXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIE5vdyB3ZSBjb25zdHJ1Y3Qgb3VyIGxpc3Qgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBjb21tYW5kXG4gIGxldCBhcmdzO1xuICBpZiAoXy5pc0Z1bmN0aW9uKHBheWxvYWRQYXJhbXMubWFrZUFyZ3MpKSB7XG4gICAgLy8gSW4gdGhlIHJvdXRlIHNwZWMsIGEgcGFydGljdWxhciByb3V0ZSBtaWdodCBkZWZpbmUgYSAnbWFrZUFyZ3MnIGZ1bmN0aW9uXG4gICAgLy8gaWYgaXQgd2FudHMgZnVsbCBjb250cm9sIG92ZXIgaG93IHRvIHR1cm4gSlNPTiBwYXJhbWV0ZXJzIGludG8gY29tbWFuZFxuICAgIC8vIGFyZ3VtZW50cy4gU28gd2UgcGFzcyBpdCB0aGUgSlNPTiBwYXJhbWV0ZXJzIGFuZCBpdCByZXR1cm5zIGFuIGFycmF5XG4gICAgLy8gd2hpY2ggd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBoYW5kbGluZyBjb21tYW5kLiBGb3IgZXhhbXBsZSBpZiBpdCByZXR1cm5zXG4gICAgLy8gWzEsIDIsIDNdLCB3ZSB3aWxsIGNhbGwgYGNvbW1hbmQoMSwgMiwgMywgLi4uKWAgKHVybCBwYXJhbXMgYXJlIHNlcGFyYXRlXG4gICAgLy8gZnJvbSBKU09OIHBhcmFtcyBhbmQgZ2V0IGNvbmNhdGVuYXRlZCBiZWxvdykuXG4gICAgYXJncyA9IHBheWxvYWRQYXJhbXMubWFrZUFyZ3MoanNvbk9iaiwgcHJvdG9jb2wpO1xuICB9IGVsc2Uge1xuICAgIC8vIE90aGVyd2lzZSwgY29sbGVjdCBhbGwgdGhlIHJlcXVpcmVkIGFuZCBvcHRpb25hbCBwYXJhbXMgYW5kIGZsYXR0ZW4gdGhlbVxuICAgIC8vIGludG8gYW4gYXJndW1lbnQgYXJyYXlcbiAgICBhcmdzID0gXy5mbGF0dGVuKHJlcXVpcmVkUGFyYW1zKS5tYXAoKHApID0+IGpzb25PYmpbcF0pO1xuICAgIGlmIChwYXlsb2FkUGFyYW1zLm9wdGlvbmFsKSB7XG4gICAgICBhcmdzID0gYXJncy5jb25jYXQoXy5mbGF0dGVuKHBheWxvYWRQYXJhbXMub3B0aW9uYWwpLm1hcCgocCkgPT4ganNvbk9ialtwXSkpO1xuICAgIH1cbiAgfVxuICAvLyBGaW5hbGx5LCBnZXQgb3VyIHVybCBwYXJhbXMgKHNlc3Npb24gaWQsIGVsZW1lbnQgaWQsIGV0Yy4uLikgb24gdGhlIGVuZCBvZlxuICAvLyB0aGUgbGlzdFxuICBhcmdzID0gYXJncy5jb25jYXQodXJsUGFyYW1zLm1hcCgodSkgPT4gcmVxdWVzdFBhcmFtc1t1XSkpO1xuICByZXR1cm4gYXJncztcbn1cblxuZnVuY3Rpb24gcm91dGVDb25maWd1cmluZ0Z1bmN0aW9uIChkcml2ZXIpIHtcbiAgaWYgKCFkcml2ZXIuc2Vzc2lvbkV4aXN0cykge1xuICAgIHRocm93IG5ldyBFcnJvcignRHJpdmVycyB1c2VkIHdpdGggTUpTT05XUCBtdXN0IGltcGxlbWVudCBgc2Vzc2lvbkV4aXN0c2AnKTtcbiAgfVxuXG4gIGlmICghKGRyaXZlci5leGVjdXRlQ29tbWFuZCB8fCBkcml2ZXIuZXhlY3V0ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0RyaXZlcnMgdXNlZCB3aXRoIE1KU09OV1AgbXVzdCBpbXBsZW1lbnQgYGV4ZWN1dGVDb21tYW5kYCBvciBgZXhlY3V0ZWAnKTtcbiAgfVxuXG4gIC8vIHJldHVybiBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYWRkIGFsbCB0aGUgcm91dGVzIHRvIHRoZSBkcml2ZXJcbiAgcmV0dXJuIGZ1bmN0aW9uIChhcHApIHtcbiAgICBmb3IgKGxldCBbcGF0aCwgbWV0aG9kc10gb2YgXy50b1BhaXJzKE1FVEhPRF9NQVApKSB7XG4gICAgICBmb3IgKGxldCBbbWV0aG9kLCBzcGVjXSBvZiBfLnRvUGFpcnMobWV0aG9kcykpIHtcbiAgICAgICAgLy8gc2V0IHVwIHRoZSBleHByZXNzIHJvdXRlIGhhbmRsZXJcbiAgICAgICAgYnVpbGRIYW5kbGVyKGFwcCwgbWV0aG9kLCBwYXRoLCBzcGVjLCBkcml2ZXIsIGlzU2Vzc2lvbkNvbW1hbmQoc3BlYy5jb21tYW5kKSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEhhbmRsZXIgKGFwcCwgbWV0aG9kLCBwYXRoLCBzcGVjLCBkcml2ZXIsIGlzU2Vzc0NtZCkge1xuICBsZXQgYXN5bmNIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgbGV0IGpzb25PYmogPSByZXEuYm9keTtcbiAgICBsZXQgaHR0cFJlc0JvZHkgPSB7fTtcbiAgICBsZXQgaHR0cFN0YXR1cyA9IDIwMDtcbiAgICBsZXQgbmV3U2Vzc2lvbklkO1xuICAgIGxldCBjdXJyZW50UHJvdG9jb2wgPSBleHRyYWN0UHJvdG9jb2woZHJpdmVyLCByZXEucGFyYW1zLnNlc3Npb25JZCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8gaWYgdGhpcyBpcyBhIHNlc3Npb24gY29tbWFuZCBidXQgd2UgZG9uJ3QgaGF2ZSBhIHNlc3Npb24sXG4gICAgICAvLyBlcnJvciBvdXQgZWFybHkgKGVzcGVjaWFsbHkgYmVmb3JlIHByb3h5aW5nKVxuICAgICAgaWYgKGlzU2Vzc0NtZCAmJiAhZHJpdmVyLnNlc3Npb25FeGlzdHMocmVxLnBhcmFtcy5zZXNzaW9uSWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuTm9TdWNoRHJpdmVyRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhlIGRyaXZlciBpcyBjdXJyZW50bHkgcHJveHlpbmcgY29tbWFuZHMgdG8gYW5vdGhlciBKU09OV1BcbiAgICAgIC8vIHNlcnZlciwgYnlwYXNzIGFsbCBvdXIgY2hlY2tzIGFuZCBhc3N1bWUgdGhlIHVwc3RyZWFtIHNlcnZlciBrbm93c1xuICAgICAgLy8gd2hhdCBpdCdzIGRvaW5nLiBCdXQga2VlcCB0aGlzIGluIHRoZSB0cnkvY2F0Y2ggYmxvY2sgc28gaWYgcHJveHlpbmdcbiAgICAgIC8vIGl0c2VsZiBmYWlscywgd2UgZ2l2ZSBhIG1lc3NhZ2UgdG8gdGhlIGNsaWVudC4gT2YgY291cnNlIHdlIG9ubHlcbiAgICAgIC8vIHdhbnQgdG8gZG8gdGhlc2Ugd2hlbiB3ZSBoYXZlIGEgc2Vzc2lvbiBjb21tYW5kOyB0aGUgQXBwaXVtIGRyaXZlclxuICAgICAgLy8gbXVzdCBiZSByZXNwb25zaWJsZSBmb3Igc3RhcnQvc3RvcCBzZXNzaW9uLCBldGMuLi5cbiAgICAgIGlmIChpc1Nlc3NDbWQgJiYgZHJpdmVyU2hvdWxkRG9Kd3BQcm94eShkcml2ZXIsIHJlcSwgc3BlYy5jb21tYW5kKSkge1xuICAgICAgICBhd2FpdCBkb0p3cFByb3h5KGRyaXZlciwgcmVxLCByZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIGEgY29tbWFuZCBpcyBub3QgaW4gb3VyIG1ldGhvZCBtYXAsIGl0J3MgYmVjYXVzZSB3ZVxuICAgICAgLy8gaGF2ZSBubyBwbGFucyB0byBldmVyIGltcGxlbWVudCBpdFxuICAgICAgaWYgKCFzcGVjLmNvbW1hbmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5Ob3RJbXBsZW1lbnRlZEVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIHdyYXAgcGFyYW1zIGlmIG5lY2Vzc2FyeVxuICAgICAgaWYgKHNwZWMucGF5bG9hZFBhcmFtcyAmJiBzcGVjLnBheWxvYWRQYXJhbXMud3JhcCkge1xuICAgICAgICBqc29uT2JqID0gd3JhcFBhcmFtcyhzcGVjLnBheWxvYWRQYXJhbXMsIGpzb25PYmopO1xuICAgICAgfVxuXG4gICAgICAvLyB1bndyYXAgcGFyYW1zIGlmIG5lY2Vzc2FyeVxuICAgICAgaWYgKHNwZWMucGF5bG9hZFBhcmFtcyAmJiBzcGVjLnBheWxvYWRQYXJhbXMudW53cmFwKSB7XG4gICAgICAgIGpzb25PYmogPSB1bndyYXBQYXJhbXMoc3BlYy5wYXlsb2FkUGFyYW1zLCBqc29uT2JqKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNwZWMuY29tbWFuZCA9PT0gQ1JFQVRFX1NFU1NJT05fQ09NTUFORCkge1xuICAgICAgICAvLyB0cnkgdG8gZGV0ZXJtaW5lIHByb3RvY29sIGJ5IHNlc3Npb24gY3JlYXRpb24gYXJncywgc28gd2UgY2FuIHRocm93IGFcbiAgICAgICAgLy8gcHJvcGVybHkgZm9ybWF0dGVkIGVycm9yIGlmIGFyZ3VtZW50cyB2YWxpZGF0aW9uIGZhaWxzXG4gICAgICAgIGN1cnJlbnRQcm90b2NvbCA9IEJhc2VEcml2ZXIuZGV0ZXJtaW5lUHJvdG9jb2woLi4ubWFrZUFyZ3MocmVxLnBhcmFtcywganNvbk9iaiwgc3BlYy5wYXlsb2FkUGFyYW1zIHx8IHt9KSk7XG4gICAgICB9XG5cbiAgICAgIC8vIGVuc3VyZSB0aGF0IHRoZSBqc29uIHBheWxvYWQgY29uZm9ybXMgdG8gdGhlIHNwZWNcbiAgICAgIGNoZWNrUGFyYW1zKHNwZWMucGF5bG9hZFBhcmFtcywganNvbk9iaiwgY3VycmVudFByb3RvY29sKTtcblxuICAgICAgLy8gdHVybiB0aGUgY29tbWFuZCBhbmQganNvbiBwYXlsb2FkIGludG8gYW4gYXJndW1lbnQgbGlzdCBmb3JcbiAgICAgIC8vIHRoZSBkcml2ZXIgbWV0aG9kc1xuICAgICAgbGV0IGFyZ3MgPSBtYWtlQXJncyhyZXEucGFyYW1zLCBqc29uT2JqLCBzcGVjLnBheWxvYWRQYXJhbXMgfHwge30sIGN1cnJlbnRQcm90b2NvbCk7XG4gICAgICBsZXQgZHJpdmVyUmVzO1xuICAgICAgLy8gdmFsaWRhdGUgY29tbWFuZCBhcmdzIGFjY29yZGluZyB0byBNSlNPTldQXG4gICAgICBpZiAodmFsaWRhdG9yc1tzcGVjLmNvbW1hbmRdKSB7XG4gICAgICAgIHZhbGlkYXRvcnNbc3BlYy5jb21tYW5kXSguLi5hcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcnVuIHRoZSBkcml2ZXIgY29tbWFuZCB3cmFwcGVkIGluc2lkZSB0aGUgYXJndW1lbnQgdmFsaWRhdG9yc1xuICAgICAgZ2V0TG9nQnlQcm90b2NvbChjdXJyZW50UHJvdG9jb2wpLmRlYnVnKGBDYWxsaW5nICR7ZHJpdmVyLmNvbnN0cnVjdG9yLm5hbWV9LiR7c3BlYy5jb21tYW5kfSgpIHdpdGggYXJnczogYCArXG4gICAgICAgIF8udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoYXJncyksIHtsZW5ndGg6IExPR19PQkpfTEVOR1RIfSkpO1xuXG4gICAgICBpZiAoZHJpdmVyLmV4ZWN1dGVDb21tYW5kKSB7XG4gICAgICAgIGRyaXZlclJlcyA9IGF3YWl0IGRyaXZlci5leGVjdXRlQ29tbWFuZChzcGVjLmNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZHJpdmVyUmVzID0gYXdhaXQgZHJpdmVyLmV4ZWN1dGUoc3BlYy5jb21tYW5kLCAuLi5hcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gR2V0IHRoZSBwcm90b2NvbCBhZnRlciBleGVjdXRlQ29tbWFuZFxuICAgICAgY3VycmVudFByb3RvY29sID0gZXh0cmFjdFByb3RvY29sKGRyaXZlciwgcmVxLnBhcmFtcy5zZXNzaW9uSWQpIHx8IGN1cnJlbnRQcm90b2NvbDtcblxuICAgICAgLy8gSWYgYGV4ZWN1dGVDb21tYW5kYCB3YXMgb3ZlcnJpZGRlbiBhbmQgdGhlIG1ldGhvZCByZXR1cm5zIGFuIG9iamVjdFxuICAgICAgLy8gd2l0aCBhIHByb3RvY29sIGFuZCB2YWx1ZS9lcnJvciBwcm9wZXJ0eSwgcmUtYXNzaWduIHRoZSBwcm90b2NvbFxuICAgICAgaWYgKF8uaXNQbGFpbk9iamVjdChkcml2ZXJSZXMpICYmIF8uaGFzKGRyaXZlclJlcywgJ3Byb3RvY29sJykpIHtcbiAgICAgICAgY3VycmVudFByb3RvY29sID0gZHJpdmVyUmVzLnByb3RvY29sIHx8IGN1cnJlbnRQcm90b2NvbDtcbiAgICAgICAgaWYgKGRyaXZlclJlcy5lcnJvcikge1xuICAgICAgICAgIHRocm93IGRyaXZlclJlcy5lcnJvcjtcbiAgICAgICAgfVxuICAgICAgICBkcml2ZXJSZXMgPSBkcml2ZXJSZXMudmFsdWU7XG4gICAgICB9XG5cbiAgICAgIC8vIHVucGFjayBjcmVhdGVTZXNzaW9uIHJlc3BvbnNlXG4gICAgICBpZiAoc3BlYy5jb21tYW5kID09PSBDUkVBVEVfU0VTU0lPTl9DT01NQU5EKSB7XG4gICAgICAgIG5ld1Nlc3Npb25JZCA9IGRyaXZlclJlc1swXTtcbiAgICAgICAgY2FjaGVQcm90b2NvbFZhbHVlKGN1cnJlbnRQcm90b2NvbCwgbmV3U2Vzc2lvbklkKTtcbiAgICAgICAgZ2V0TG9nQnlQcm90b2NvbChjdXJyZW50UHJvdG9jb2wpXG4gICAgICAgICAgLmRlYnVnKGBDYWNoZWQgdGhlIHByb3RvY29sIHZhbHVlICcke2N1cnJlbnRQcm90b2NvbH0nIGZvciB0aGUgbmV3IHNlc3Npb24gJHtuZXdTZXNzaW9uSWR9YCk7XG4gICAgICAgIGlmIChjdXJyZW50UHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLk1KU09OV1ApIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSBkcml2ZXJSZXNbMV07XG4gICAgICAgIH0gZWxzZSBpZiAoY3VycmVudFByb3RvY29sID09PSBCYXNlRHJpdmVyLkRSSVZFUl9QUk9UT0NPTC5XM0MpIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSB7XG4gICAgICAgICAgICBjYXBhYmlsaXRpZXM6IGRyaXZlclJlc1sxXSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBJZiB0aGUgTUpTT05XUCBlbGVtZW50IGtleSBmb3JtYXQgKEVMRU1FTlQpIHdhcyBwcm92aWRlZCB0cmFuc2xhdGUgaXQgdG8gVzNDIGVsZW1lbnQga2V5IGZvcm1hdCAoZWxlbWVudC02MDY2LTExZTQtYTUyZS00ZjczNTQ2NmNlY2YpXG4gICAgICAvLyBhbmQgdmljZS12ZXJzYVxuICAgICAgaWYgKGRyaXZlclJlcykge1xuICAgICAgICBpZiAoY3VycmVudFByb3RvY29sID09PSBCYXNlRHJpdmVyLkRSSVZFUl9QUk9UT0NPTC5XM0MpIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSByZW5hbWVLZXkoZHJpdmVyUmVzLCBNSlNPTldQX0VMRU1FTlRfS0VZLCBXM0NfRUxFTUVOVF9LRVkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRyaXZlclJlcyA9IHJlbmFtZUtleShkcml2ZXJSZXMsIFczQ19FTEVNRU5UX0tFWSwgTUpTT05XUF9FTEVNRU5UX0tFWSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gY29udmVydCB1bmRlZmluZWQgdG8gbnVsbCwgYnV0IGxlYXZlIGFsbCBvdGhlciB2YWx1ZXMgdGhlIHNhbWVcbiAgICAgIGlmIChfLmlzVW5kZWZpbmVkKGRyaXZlclJlcykpIHtcbiAgICAgICAgZHJpdmVyUmVzID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgLy8gZGVsZXRlIHNob3VsZCBub3QgcmV0dXJuIGFueXRoaW5nIGV2ZW4gaWYgc3VjY2Vzc2Z1bFxuICAgICAgaWYgKHNwZWMuY29tbWFuZCA9PT0gREVMRVRFX1NFU1NJT05fQ09NTUFORCkge1xuICAgICAgICBnZXRMb2dCeVByb3RvY29sKGN1cnJlbnRQcm90b2NvbClcbiAgICAgICAgICAuZGVidWcoYFJlY2VpdmVkIHJlc3BvbnNlOiAke18udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoZHJpdmVyUmVzKSwge2xlbmd0aDogTE9HX09CSl9MRU5HVEh9KX1gKTtcbiAgICAgICAgZ2V0TG9nQnlQcm90b2NvbChjdXJyZW50UHJvdG9jb2wpXG4gICAgICAgICAgLmRlYnVnKCdCdXQgZGVsZXRpbmcgc2Vzc2lvbiwgc28gbm90IHJldHVybmluZycpO1xuICAgICAgICBkcml2ZXJSZXMgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICAvLyBpZiB0aGUgc3RhdHVzIGlzIG5vdCAwLCAgdGhyb3cgdGhlIGFwcHJvcHJpYXRlIGVycm9yIGZvciBzdGF0dXMgY29kZS5cbiAgICAgIGlmICh1dGlsLmhhc1ZhbHVlKGRyaXZlclJlcykpIHtcbiAgICAgICAgaWYgKHV0aWwuaGFzVmFsdWUoZHJpdmVyUmVzLnN0YXR1cykgJiYgIWlzTmFOKGRyaXZlclJlcy5zdGF0dXMpICYmIHBhcnNlSW50KGRyaXZlclJlcy5zdGF0dXMsIDEwKSAhPT0gMCkge1xuICAgICAgICAgIHRocm93IGVycm9yRnJvbU1KU09OV1BTdGF0dXNDb2RlKGRyaXZlclJlcy5zdGF0dXMsIGRyaXZlclJlcy52YWx1ZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoXy5pc1BsYWluT2JqZWN0KGRyaXZlclJlcy52YWx1ZSkgJiYgZHJpdmVyUmVzLnZhbHVlLmVycm9yKSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3JGcm9tVzNDSnNvbkNvZGUoZHJpdmVyUmVzLnZhbHVlLmVycm9yLCBkcml2ZXJSZXMudmFsdWUubWVzc2FnZSwgZHJpdmVyUmVzLnZhbHVlLnN0YWNrdHJhY2UpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFJlc3BvbnNlIHN0YXR1cyBzaG91bGQgYmUgdGhlIHN0YXR1cyBzZXQgYnkgdGhlIGRyaXZlciByZXNwb25zZS5cbiAgICAgIGlmIChjdXJyZW50UHJvdG9jb2wgIT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQykge1xuICAgICAgICBodHRwUmVzQm9keS5zdGF0dXMgPSAoXy5pc05pbChkcml2ZXJSZXMpIHx8IF8uaXNVbmRlZmluZWQoZHJpdmVyUmVzLnN0YXR1cykpID8gSlNPTldQX1NVQ0NFU1NfU1RBVFVTX0NPREUgOiBkcml2ZXJSZXMuc3RhdHVzO1xuICAgICAgfVxuICAgICAgaHR0cFJlc0JvZHkudmFsdWUgPSBkcml2ZXJSZXM7XG4gICAgICBnZXRMb2dCeVByb3RvY29sKGN1cnJlbnRQcm90b2NvbCkuZGVidWcoYFJlc3BvbmRpbmcgdG8gY2xpZW50IHdpdGggZHJpdmVyLiR7c3BlYy5jb21tYW5kfSgpIGAgK1xuICAgICAgICBgcmVzdWx0OiAke18udHJ1bmNhdGUoSlNPTi5zdHJpbmdpZnkoZHJpdmVyUmVzKSwge2xlbmd0aDogTE9HX09CSl9MRU5HVEh9KX1gKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIC8vIGlmIGFueXRoaW5nIGdvZXMgd3JvbmcsIGZpZ3VyZSBvdXQgd2hhdCBvdXIgcmVzcG9uc2Ugc2hvdWxkIGJlXG4gICAgICAvLyBiYXNlZCBvbiB0aGUgdHlwZSBvZiBlcnJvciB0aGF0IHdlIGVuY291bnRlcmVkXG4gICAgICBsZXQgYWN0dWFsRXJyID0gZXJyO1xuXG4gICAgICBjdXJyZW50UHJvdG9jb2wgPSBjdXJyZW50UHJvdG9jb2wgfHwgZXh0cmFjdFByb3RvY29sKGRyaXZlciwgcmVxLnBhcmFtcy5zZXNzaW9uSWQgfHwgbmV3U2Vzc2lvbklkKTtcblxuICAgICAgbGV0IGVyck1zZyA9IGVyci5zdGFja3RyYWNlIHx8IGVyci5zdGFjaztcbiAgICAgIGlmICghZXJyTXNnLmluY2x1ZGVzKGVyci5tZXNzYWdlKSkge1xuICAgICAgICAvLyBpZiB0aGUgbWVzc2FnZSBoYXMgbW9yZSBpbmZvcm1hdGlvbiwgYWRkIGl0LiBidXQgb2Z0ZW4gdGhlIG1lc3NhZ2VcbiAgICAgICAgLy8gaXMgdGhlIGZpcnN0IHBhcnQgb2YgdGhlIHN0YWNrIHRyYWNlXG4gICAgICAgIGVyck1zZyA9IGAke2Vyci5tZXNzYWdlfSAke2Vyck1zZ31gO1xuICAgICAgfVxuICAgICAgZ2V0TG9nQnlQcm90b2NvbChjdXJyZW50UHJvdG9jb2wpLmRlYnVnKGBFbmNvdW50ZXJlZCBpbnRlcm5hbCBlcnJvciBydW5uaW5nIGNvbW1hbmQ6ICR7ZXJyTXNnfWApO1xuICAgICAgaWYgKGlzRXJyb3JUeXBlKGVyciwgZXJyb3JzLlByb3h5UmVxdWVzdEVycm9yKSkge1xuICAgICAgICBhY3R1YWxFcnIgPSBlcnIuZ2V0QWN0dWFsRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGN1cnJlbnRQcm90b2NvbCA9PT0gQmFzZURyaXZlci5EUklWRVJfUFJPVE9DT0wuVzNDKSB7XG4gICAgICAgIFtodHRwU3RhdHVzLCBodHRwUmVzQm9keV0gPSBnZXRSZXNwb25zZUZvclczQ0Vycm9yKGFjdHVhbEVycik7XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnRQcm90b2NvbCA9PT0gQmFzZURyaXZlci5EUklWRVJfUFJPVE9DT0wuTUpTT05XUCkge1xuICAgICAgICBbaHR0cFN0YXR1cywgaHR0cFJlc0JvZHldID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgaXQncyB1bmtub3duIHdoYXQgdGhlIHByb3RvY29sIGlzIChsaWtlIGlmIGl0J3MgYGdldFN0YXR1c2AgcHJpb3IgdG8gYGNyZWF0ZVNlc3Npb25gKSwgbWVyZ2UgdGhlIHJlc3BvbnNlc1xuICAgICAgICAvLyB0b2dldGhlciB0byBiZSBwcm90b2NvbC1hZ25vc3RpY1xuICAgICAgICBsZXQganNvbndwUmVzID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgICBsZXQgdzNjUmVzID0gZ2V0UmVzcG9uc2VGb3JXM0NFcnJvcihhY3R1YWxFcnIpO1xuXG4gICAgICAgIGh0dHBSZXNCb2R5ID0ge1xuICAgICAgICAgIC4uLmpzb253cFJlc1sxXSxcbiAgICAgICAgICAuLi53M2NSZXNbMV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVXNlIHRoZSBKU09OV1Agc3RhdHVzIGNvZGUgKHdoaWNoIGlzIHVzdWFsbHkgNTAwKVxuICAgICAgICBodHRwU3RhdHVzID0ganNvbndwUmVzWzBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRlY29kZSB0aGUgcmVzcG9uc2UsIHdoaWNoIGlzIGVpdGhlciBhIHN0cmluZyBvciBqc29uXG4gICAgaWYgKF8uaXNTdHJpbmcoaHR0cFJlc0JvZHkpKSB7XG4gICAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMpLnNlbmQoaHR0cFJlc0JvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobmV3U2Vzc2lvbklkKSB7XG4gICAgICAgIGlmIChjdXJyZW50UHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQykge1xuICAgICAgICAgIGh0dHBSZXNCb2R5LnZhbHVlLnNlc3Npb25JZCA9IG5ld1Nlc3Npb25JZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBodHRwUmVzQm9keS5zZXNzaW9uSWQgPSBuZXdTZXNzaW9uSWQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0dHBSZXNCb2R5LnNlc3Npb25JZCA9IHJlcS5wYXJhbXMuc2Vzc2lvbklkIHx8IG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIERvbid0IGluY2x1ZGUgc2Vzc2lvbklkIGluIFczQyByZXNwb25zZXNcbiAgICAgIGlmIChjdXJyZW50UHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQykge1xuICAgICAgICBkZWxldGUgaHR0cFJlc0JvZHkuc2Vzc2lvbklkO1xuICAgICAgfVxuICAgICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzKS5qc29uKGh0dHBSZXNCb2R5KTtcbiAgICB9XG4gIH07XG4gIC8vIGFkZCB0aGUgbWV0aG9kIHRvIHRoZSBhcHBcbiAgYXBwW21ldGhvZC50b0xvd2VyQ2FzZSgpXShwYXRoLCAocmVxLCByZXMpID0+IHtcbiAgICBCLnJlc29sdmUoYXN5bmNIYW5kbGVyKHJlcSwgcmVzKSkuZG9uZSgpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZHJpdmVyU2hvdWxkRG9Kd3BQcm94eSAoZHJpdmVyLCByZXEsIGNvbW1hbmQpIHtcbiAgLy8gZHJpdmVycyBuZWVkIHRvIGV4cGxpY2l0bHkgc2F5IHdoZW4gdGhlIHByb3h5IGlzIGFjdGl2ZVxuICBpZiAoIWRyaXZlci5wcm94eUFjdGl2ZShyZXEucGFyYW1zLnNlc3Npb25JZCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB3ZSBzaG91bGQgbmV2ZXIgcHJveHkgZGVsZXRlU2Vzc2lvbiBiZWNhdXNlIHdlIG5lZWQgdG8gZ2l2ZSB0aGUgY29udGFpbmluZ1xuICAvLyBkcml2ZXIgYW4gb3Bwb3J0dW5pdHkgdG8gY2xlYW4gaXRzZWxmIHVwXG4gIGlmIChjb21tYW5kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB2YWxpZGF0ZSBhdm9pZGFuY2Ugc2NoZW1hLCBhbmQgc2F5IHdlIHNob3VsZG4ndCBwcm94eSBpZiBhbnl0aGluZyBpbiB0aGVcbiAgLy8gYXZvaWQgbGlzdCBtYXRjaGVzIG91ciByZXFcbiAgaWYgKGRyaXZlci5wcm94eVJvdXRlSXNBdm9pZGVkKHJlcS5wYXJhbXMuc2Vzc2lvbklkLCByZXEubWV0aG9kLCByZXEub3JpZ2luYWxVcmwpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gaWYgaXQgbG9va3MgbGlrZSB3ZSBoYXZlIGFuIGltYWdlIGVsZW1lbnQgaW4gdGhlIHVybCAoYXMgYSByb3V0ZVxuICAvLyBwYXJhbWV0ZXIpLCBuZXZlciBwcm94eS4gSnVzdCBsb29rIGZvciBvdXIgaW1hZ2UgZWxlbWVudCBwcmVmaXggaW4gYWxsb3dlZFxuICAvLyBwb3NpdGlvbnMgKGVpdGhlciBhZnRlciBhbiAnZWxlbWVudCcgb3IgJ3NjcmVlbnNob3QnIHBhdGggc2VnbWVudCksIGFuZFxuICAvLyBlbnN1cmUgdGhlIHByZWZpeCBpcyBmb2xsb3dlZCBieSBzb21ldGhpbmdcbiAgaWYgKElNR19FTF9VUkxfUkUudGVzdChyZXEub3JpZ2luYWxVcmwpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBhbHNvIGlmIGl0IGxvb2tzIGxpa2Ugd2UgaGF2ZSBhbiBpbWFnZSBlbGVtZW50IGluIHRoZSByZXF1ZXN0IGJvZHkgKGFzXG4gIC8vIGEgSlNPTiBwYXJhbWV0ZXIpLCBuZXZlciBwcm94eS4gQmFzaWNhbGx5IGNoZWNrIGFnYWluc3QgYSByZWdleHAgb2YgdGhlXG4gIC8vIGpzb24gc3RyaW5nIG9mIHRoZSBib2R5LCB3aGVyZSB3ZSBrbm93IHdoYXQgdGhlIGZvcm0gb2YgYW4gaW1hZ2UgZWxlbWVudFxuICAvLyBtdXN0IGJlXG4gIGNvbnN0IHN0cmluZ0JvZHkgPSBKU09OLnN0cmluZ2lmeShyZXEuYm9keSk7XG4gIGlmIChzdHJpbmdCb2R5ICYmIElNR19FTF9CT0RZX1JFLnRlc3Qoc3RyaW5nQm9keSkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZG9Kd3BQcm94eSAoZHJpdmVyLCByZXEsIHJlcykge1xuICBjb25zdCBsb2cgPSBnZXRMb2dCeVByb3RvY29sKGV4dHJhY3RQcm90b2NvbChkcml2ZXIsIHJlcS5wYXJhbXMuc2Vzc2lvbklkKSk7XG4gIGxvZy5pbmZvKCdEcml2ZXIgcHJveHkgYWN0aXZlLCBwYXNzaW5nIHJlcXVlc3Qgb24gdmlhIEhUVFAgcHJveHknKTtcblxuICAvLyBjaGVjayB0aGF0IHRoZSBpbm5lciBkcml2ZXIgaGFzIGEgcHJveHkgZnVuY3Rpb25cbiAgaWYgKCFkcml2ZXIuY2FuUHJveHkocmVxLnBhcmFtcy5zZXNzaW9uSWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdUcnlpbmcgdG8gcHJveHkgdG8gYSBKU09OV1Agc2VydmVyIGJ1dCBkcml2ZXIgaXMgdW5hYmxlIHRvIHByb3h5Jyk7XG4gIH1cbiAgdHJ5IHtcbiAgICBjb25zdCBwcm94aWVkUmVzID0gYXdhaXQgZHJpdmVyLmV4ZWN1dGVDb21tYW5kKCdwcm94eVJlcVJlcycsIHJlcSwgcmVzLCByZXEucGFyYW1zLnNlc3Npb25JZCk7XG4gICAgaWYgKHByb3hpZWRSZXMgJiYgcHJveGllZFJlcy5lcnJvcikgdGhyb3cgcHJveGllZFJlcy5lcnJvcjsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBjdXJseVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoaXNFcnJvclR5cGUoZXJyLCBlcnJvcnMuUHJveHlSZXF1ZXN0RXJyb3IpKSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHByb3h5LiBQcm94eSBlcnJvcjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICB9XG4gIH1cbn1cblxuXG5leHBvcnQgeyBQcm90b2NvbCwgcm91dGVDb25maWd1cmluZ0Z1bmN0aW9uLCBpc1Nlc3Npb25Db21tYW5kLFxuICAgICAgICAgTUpTT05XUF9FTEVNRU5UX0tFWSwgVzNDX0VMRU1FTlRfS0VZLCBJTUFHRV9FTEVNRU5UX1BSRUZJWCxcbiAgICAgICAgIGRyaXZlclNob3VsZERvSndwUHJveHkgfTtcbiJdLCJzb3VyY2VSb290IjoiLi4vLi4vLi4ifQ==
