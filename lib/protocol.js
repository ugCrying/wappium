"use strict";
//用于替换 \node_modules\appium\node_modules\appium-base-driver\build\lib\protocol\protocol.js
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
              context$2$0.next = 66;
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

              if (
                (0, _errors.isErrorType)(
                  context$2$0.t0,
                  _errors.errors.ProxyRequestError
                )
              ) {
                protocolLogger.error(
                  "Encountered internal error running command:  " +
                    JSON.stringify(context$2$0.t0) +
                    " " +
                    context$2$0.t0.stack
                );
                actualErr = context$2$0.t0.getActualError();
              } else if (
                !isW3C &&
                !(
                  (0, _errors.isErrorType)(
                    context$2$0.t0,
                    _errors.ProtocolError
                  ) ||
                  (0, _errors.isErrorType)(
                    context$2$0.t0,
                    _errors.errors.BadParametersError
                  )
                )
              ) {
                protocolLogger.error(
                  "Encountered internal error running command: " +
                    (context$2$0.t0.stacktrace || context$2$0.t0.stack)
                );
                actualErr = new _errors.errors.UnknownError(context$2$0.t0);
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

            case 66:
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

            case 67:
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
  var proxyAvoidList = driver.getProxyAvoidList(req.params.sessionId);
  var _iteratorNormalCompletion5 = true;
  var _didIteratorError5 = false;
  var _iteratorError5 = undefined;

  try {
    for (
      var _iterator5 = _getIterator(proxyAvoidList), _step5;
      !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done);
      _iteratorNormalCompletion5 = true
    ) {
      var avoidSchema = _step5.value;

      if (
        !_lodash2["default"].isArray(avoidSchema) ||
        avoidSchema.length !== 2
      ) {
        throw new Error("Proxy avoidance must be a list of pairs");
      }

      var _avoidSchema = _slicedToArray(avoidSchema, 2);

      var avoidMethod = _avoidSchema[0];
      var avoidPathRegex = _avoidSchema[1];

      if (
        !_lodash2["default"].includes(["GET", "POST", "DELETE"], avoidMethod)
      ) {
        throw new Error(
          "Unrecognized proxy avoidance method '" + avoidMethod + "'"
        );
      }
      if (!(avoidPathRegex instanceof RegExp)) {
        throw new Error("Proxy avoidance path must be a regular expression");
      }
      var normalizedUrl = req.originalUrl.replace(/^\/wd\/hub/, "");
      if (avoidMethod === req.method && avoidPathRegex.test(normalizedUrl)) {
        return false;
      }
    }
  } catch (err) {
    _didIteratorError5 = true;
    _iteratorError5 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion5 && _iterator5["return"]) {
        _iterator5["return"]();
      }
    } finally {
      if (_didIteratorError5) {
        throw _iteratorError5;
      }
    }
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
exports.parseProtocol = parseProtocol;

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9wcm90b2NvbC9wcm90b2NvbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztzQkFBYyxRQUFROzs7OzZCQUNPLGdCQUFnQjs7MEJBQ2xCLGNBQWM7O3NCQUMrRyxVQUFVOztzQkFDL0csVUFBVTs7aUNBQ25DLHVCQUF1Qjs7d0JBQ25DLFVBQVU7Ozs7Z0NBQ0Qsc0JBQXNCOzs7O0FBRzdDLElBQU0sVUFBVSxHQUFHLHNCQUFPLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMvQyxJQUFNLE1BQU0sR0FBRyxzQkFBTyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7O0FBRXZDLElBQU0sMEJBQTBCLEdBQUcsQ0FBQyxDQUFDOztBQUVyQyxJQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7O0FBRTVCLElBQU0sbUJBQW1CLEdBQUcsU0FBUyxDQUFDO0FBQ3RDLElBQU0sZUFBZSxHQUFHLHFDQUFxQyxDQUFDOztJQUV4RCxRQUFRLFlBQVIsUUFBUTt3QkFBUixRQUFROzs7QUFFZCxTQUFTLGdCQUFnQixDQUFFLE1BQU0sRUFBRTtBQUNqQyxTQUFPLE1BQU0sQ0FBQyxhQUFhLEVBQUUsR0FBRyxNQUFNLEdBQUcsVUFBVSxDQUFDO0NBQ3JEOztBQUVELFNBQVMsZ0JBQWdCLENBQUUsT0FBTyxFQUFFO0FBQ2xDLFNBQU8sQ0FBQyxvQkFBRSxRQUFRLGlDQUF5QixPQUFPLENBQUMsQ0FBQztDQUNyRDs7QUFFRCxTQUFTLFVBQVUsQ0FBRSxTQUFTLEVBQUUsT0FBTyxFQUFFOzs7Ozs7O0FBT3ZDLE1BQUksR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUNsQixNQUFJLG9CQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUM5QyxPQUFHLEdBQUcsRUFBRSxDQUFDO0FBQ1QsT0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUM7R0FDL0I7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RSxXQUFPLElBQUksQ0FBQztHQUNiOztBQUVELE1BQUksS0FBSyxHQUFHLFNBQVMsQ0FBQyxRQUFRLEtBQUssOEJBQVcsZUFBZSxDQUFDLEdBQUcsQ0FBQztBQUNsRSxNQUFJLFNBQVMsR0FBRyxTQUFTLENBQUMsUUFBUSxLQUFLLDhCQUFXLGVBQWUsQ0FBQyxPQUFPLENBQUM7O0FBRTFFLE1BQUksb0JBQUUsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsRUFBRTtBQUM3QixXQUFPLEVBQUMsS0FBSyxFQUFMLEtBQUssRUFBRSxTQUFTLEVBQVQsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsS0FBSyxFQUFDLENBQUM7R0FDbkQ7O0FBRUQsTUFBSSxvQkFBRSxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzlCLFdBQU8sRUFBQyxLQUFLLEVBQUwsS0FBSyxFQUFFLFNBQVMsRUFBVCxTQUFTLEVBQUUsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUMsQ0FBQztHQUNuRDs7QUFFRCxTQUFPLElBQUksQ0FBQztDQUNiOztRQUdRLFFBQVEsR0FBUixRQUFRO1FBQUUsd0JBQXdCLEdBQXhCLHdCQUF3QjtRQUFFLGdCQUFnQixHQUFoQixnQkFBZ0I7UUFBRSxtQkFBbUIsR0FBbkIsbUJBQW1CO1FBQUUsZUFBZSxHQUFmLGVBQWU7UUFBRSxhQUFhLEdBQWIsYUFBYSIsImZpbGUiOiJsaWIvcHJvdG9jb2wvcHJvdG9jb2wuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgbG9nZ2VyLCB1dGlsIH0gZnJvbSAnYXBwaXVtLXN1cHBvcnQnO1xuaW1wb3J0IHsgdmFsaWRhdG9ycyB9IGZyb20gJy4vdmFsaWRhdG9ycyc7XG5pbXBvcnQgeyBlcnJvcnMsIGlzRXJyb3JUeXBlLCBQcm90b2NvbEVycm9yLCBlcnJvckZyb21NSlNPTldQU3RhdHVzQ29kZSwgZXJyb3JGcm9tVzNDSnNvbkNvZGUsIGdldFJlc3BvbnNlRm9yVzNDRXJyb3IsIGdldFJlc3BvbnNlRm9ySnNvbndwRXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5pbXBvcnQgeyBNRVRIT0RfTUFQLCBOT19TRVNTSU9OX0lEX0NPTU1BTkRTIH0gZnJvbSAnLi9yb3V0ZXMnO1xuaW1wb3J0IHsgcmVuYW1lS2V5IH0gZnJvbSAnLi4vYmFzZWRyaXZlci9oZWxwZXJzJztcbmltcG9ydCBCIGZyb20gJ2JsdWViaXJkJztcbmltcG9ydCBCYXNlRHJpdmVyIGZyb20gJy4uL2Jhc2Vkcml2ZXIvZHJpdmVyJztcblxuXG5jb25zdCBtanNvbndwTG9nID0gbG9nZ2VyLmdldExvZ2dlcignTUpTT05XUCcpO1xuY29uc3QgdzNjTG9nID0gbG9nZ2VyLmdldExvZ2dlcignVzNDJyk7XG5cbmNvbnN0IEpTT05XUF9TVUNDRVNTX1NUQVRVU19DT0RFID0gMDtcbi8vIFRPRE86IE1ha2UgdGhpcyB2YWx1ZSBjb25maWd1cmFibGUgYXMgYSBzZXJ2ZXIgc2lkZSBjYXBhYmlsaXR5XG5jb25zdCBMT0dfT0JKX0xFTkdUSCA9IDEwMjQ7IC8vIE1BWCBMRU5HVEggTG9nZ2VkIHRvIGZpbGUgLyBjb25zb2xlXG5cbmNvbnN0IE1KU09OV1BfRUxFTUVOVF9LRVkgPSAnRUxFTUVOVCc7XG5jb25zdCBXM0NfRUxFTUVOVF9LRVkgPSAnZWxlbWVudC02MDY2LTExZTQtYTUyZS00ZjczNTQ2NmNlY2YnO1xuXG5jbGFzcyBQcm90b2NvbCB7fVxuXG5mdW5jdGlvbiBnZXRMb2dCeVByb3RvY29sIChkcml2ZXIpIHtcbiAgcmV0dXJuIGRyaXZlci5pc1czQ1Byb3RvY29sKCkgPyB3M2NMb2cgOiBtanNvbndwTG9nO1xufVxuXG5mdW5jdGlvbiBpc1Nlc3Npb25Db21tYW5kIChjb21tYW5kKSB7XG4gIHJldHVybiAhXy5pbmNsdWRlcyhOT19TRVNTSU9OX0lEX0NPTU1BTkRTLCBjb21tYW5kKTtcbn1cblxuZnVuY3Rpb24gd3JhcFBhcmFtcyAocGFyYW1TZXRzLCBqc29uT2JqKSB7XG4gIC8qIFRoZXJlIGFyZSBjb21tYW5kcyBsaWtlIHBlcmZvcm1Ub3VjaCB3aGljaCB0YWtlIGEgc2luZ2xlIHBhcmFtZXRlciAocHJpbWl0aXZlIHR5cGUgb3IgYXJyYXkpLlxuICAgKiBTb21lIGRyaXZlcnMgY2hvb3NlIHRvIHBhc3MgdGhpcyBwYXJhbWV0ZXIgYXMgYSB2YWx1ZSAoZWcuIFthY3Rpb24xLCBhY3Rpb24yLi4uXSkgd2hpbGUgb3RoZXJzIHRvXG4gICAqIHdyYXAgaXQgd2l0aGluIGFuIG9iamVjdChlZycge2dlc3R1cmU6ICBbYWN0aW9uMSwgYWN0aW9uMi4uLl19KSwgd2hpY2ggbWFrZXMgaXQgaGFyZCB0byB2YWxpZGF0ZS5cbiAgICogVGhlIHdyYXAgb3B0aW9uIGluIHRoZSBzcGVjIGVuZm9yY2Ugd3JhcHBpbmcgYmVmb3JlIHZhbGlkYXRpb24sIHNvIHRoYXQgYWxsIHBhcmFtcyBhcmUgd3JhcHBlZCBhdFxuICAgKiB0aGUgdGltZSB0aGV5IGFyZSB2YWxpZGF0ZWQgYW5kIGxhdGVyIHBhc3NlZCB0byB0aGUgY29tbWFuZHMuXG4gICAqL1xuICBsZXQgcmVzID0ganNvbk9iajtcbiAgaWYgKF8uaXNBcnJheShqc29uT2JqKSB8fCAhXy5pc09iamVjdChqc29uT2JqKSkge1xuICAgIHJlcyA9IHt9O1xuICAgIHJlc1twYXJhbVNldHMud3JhcF0gPSBqc29uT2JqO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIHVud3JhcFBhcmFtcyAocGFyYW1TZXRzLCBqc29uT2JqKSB7XG4gIC8qIFRoZXJlIGFyZSBjb21tYW5kcyBsaWtlIHNldE5ldHdvcmtDb25uZWN0aW9uIHdoaWNoIHNlbmQgcGFyYW1ldGVycyB3cmFwcGVkIGluc2lkZSBhIGtleSBzdWNoIGFzXG4gICAqIFwicGFyYW1ldGVyc1wiLiBUaGlzIGZ1bmN0aW9uIHVud3JhcHMgdGhlbSAoZWcuIHtcInBhcmFtZXRlcnNcIjoge1widHlwZVwiOiAxfX0gYmVjb21lcyB7XCJ0eXBlXCI6IDF9KS5cbiAgICovXG4gIGxldCByZXMgPSBqc29uT2JqO1xuICBpZiAoXy5pc09iamVjdChqc29uT2JqKSkge1xuICAgIC8vIHNvbWUgY2xpZW50cywgbGlrZSBydWJ5LCBkb24ndCB3cmFwXG4gICAgaWYgKGpzb25PYmpbcGFyYW1TZXRzLnVud3JhcF0pIHtcbiAgICAgIHJlcyA9IGpzb25PYmpbcGFyYW1TZXRzLnVud3JhcF07XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNoZWNrUGFyYW1zIChwYXJhbVNldHMsIGpzb25PYmosIHByb3RvY29sKSB7XG4gIGxldCByZXF1aXJlZFBhcmFtcyA9IFtdO1xuICBsZXQgb3B0aW9uYWxQYXJhbXMgPSBbXTtcbiAgbGV0IHJlY2VpdmVkUGFyYW1zID0gXy5rZXlzKGpzb25PYmopO1xuXG4gIGlmIChwYXJhbVNldHMpIHtcbiAgICBpZiAocGFyYW1TZXRzLnJlcXVpcmVkKSB7XG4gICAgICAvLyB3ZSBtaWdodCBoYXZlIGFuIGFycmF5IG9mIHBhcmFtZXRlcnMsXG4gICAgICAvLyBvciBhbiBhcnJheSBvZiBhcnJheXMgb2YgcGFyYW1ldGVycywgc28gc3RhbmRhcmRpemVcbiAgICAgIGlmICghXy5pc0FycmF5KF8uZmlyc3QocGFyYW1TZXRzLnJlcXVpcmVkKSkpIHtcbiAgICAgICAgcmVxdWlyZWRQYXJhbXMgPSBbcGFyYW1TZXRzLnJlcXVpcmVkXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW1zID0gcGFyYW1TZXRzLnJlcXVpcmVkO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBvcHRpb25hbCBwYXJhbWV0ZXJzIGFyZSBqdXN0IGFuIGFycmF5XG4gICAgaWYgKHBhcmFtU2V0cy5vcHRpb25hbCkge1xuICAgICAgb3B0aW9uYWxQYXJhbXMgPSBwYXJhbVNldHMub3B0aW9uYWw7XG4gICAgfVxuXG4gICAgLy8gSWYgYSBmdW5jdGlvbiB3YXMgcHJvdmlkZWQgYXMgdGhlICd2YWxpZGF0ZScga2V5LCBpdCB3aWxsIGhlcmUgYmUgY2FsbGVkIHdpdGhcbiAgICAvLyBqc29uT2JqIGFzIHRoZSBwYXJhbS4gSWYgaXQgcmV0dXJucyBzb21ldGhpbmcgZmFsc3ksIHZlcmlmaWNhdGlvbiB3aWxsIGJlXG4gICAgLy8gY29uc2lkZXJlZCB0byBoYXZlIHBhc3NlZC4gSWYgaXQgcmV0dXJucyBzb21ldGhpbmcgZWxzZSwgdGhhdCB3aWxsIGJlIHRoZVxuICAgIC8vIGFyZ3VtZW50IHRvIGFuIGVycm9yIHdoaWNoIGlzIHRocm93biB0byB0aGUgdXNlclxuICAgIGlmIChwYXJhbVNldHMudmFsaWRhdGUpIHtcbiAgICAgIGxldCBtZXNzYWdlID0gcGFyYW1TZXRzLnZhbGlkYXRlKGpzb25PYmosIHByb3RvY29sKTtcbiAgICAgIGlmIChtZXNzYWdlKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuQmFkUGFyYW1ldGVyc0Vycm9yKG1lc3NhZ2UsIGpzb25PYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHdlIGhhdmUgbm8gcmVxdWlyZWQgcGFyYW1ldGVycywgYWxsIGlzIHdlbGxcbiAgaWYgKHJlcXVpcmVkUGFyYW1zLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIHNvbWUgY2xpZW50cyBwYXNzIGluIHRoZSBzZXNzaW9uIGlkIGluIHRoZSBwYXJhbXNcbiAgaWYgKG9wdGlvbmFsUGFyYW1zLmluZGV4T2YoJ3Nlc3Npb25JZCcpID09PSAtMSkge1xuICAgIG9wdGlvbmFsUGFyYW1zLnB1c2goJ3Nlc3Npb25JZCcpO1xuICB9XG5cbiAgLy8gc29tZSBjbGllbnRzIHBhc3MgaW4gYW4gZWxlbWVudCBpZCBpbiB0aGUgcGFyYW1zXG4gIGlmIChvcHRpb25hbFBhcmFtcy5pbmRleE9mKCdpZCcpID09PSAtMSkge1xuICAgIG9wdGlvbmFsUGFyYW1zLnB1c2goJ2lkJyk7XG4gIH1cblxuICAvLyBnbyB0aHJvdWdoIHRoZSByZXF1aXJlZCBwYXJhbWV0ZXJzIGFuZCBjaGVjayBhZ2FpbnN0IG91ciBhcmd1bWVudHNcbiAgZm9yIChsZXQgcGFyYW1zIG9mIHJlcXVpcmVkUGFyYW1zKSB7XG4gICAgaWYgKF8uZGlmZmVyZW5jZShyZWNlaXZlZFBhcmFtcywgcGFyYW1zLCBvcHRpb25hbFBhcmFtcykubGVuZ3RoID09PSAwICYmXG4gICAgICAgIF8uZGlmZmVyZW5jZShwYXJhbXMsIHJlY2VpdmVkUGFyYW1zKS5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIHdlIGhhdmUgYSBzZXQgb2YgcGFyYW1ldGVycyB0aGF0IGlzIGNvcnJlY3RcbiAgICAgIC8vIHNvIHNob3J0LWNpcmN1aXRcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IGVycm9ycy5CYWRQYXJhbWV0ZXJzRXJyb3IocGFyYW1TZXRzLCByZWNlaXZlZFBhcmFtcyk7XG59XG5cbi8qXG4gKiBUaGlzIG1ldGhvZCB0YWtlcyAzIHBpZWNlcyBvZiBkYXRhOiByZXF1ZXN0IHBhcmFtZXRlcnMgKCdyZXF1ZXN0UGFyYW1zJyksXG4gKiBhIHJlcXVlc3QgSlNPTiBib2R5ICgnanNvbk9iaicpLCBhbmQgJ3BheWxvYWRQYXJhbXMnLCB3aGljaCBpcyB0aGUgc2VjdGlvblxuICogZnJvbSB0aGUgcm91dGUgZGVmaW5pdGlvbiBmb3IgYSBwYXJ0aWN1bGFyIGVuZHBvaW50IHdoaWNoIGhhcyBpbnN0cnVjdGlvbnNcbiAqIG9uIGhhbmRsaW5nIHBhcmFtZXRlcnMuIFRoaXMgbWV0aG9kIHJldHVybnMgYW4gYXJyYXkgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGxcbiAqIGJlIGFwcGxpZWQgdG8gYSBjb21tYW5kLlxuICovXG5mdW5jdGlvbiBtYWtlQXJncyAocmVxdWVzdFBhcmFtcywganNvbk9iaiwgcGF5bG9hZFBhcmFtcywgcHJvdG9jb2wpIHtcbiAgLy8gV2Ugd2FudCB0byBwYXNzIHRoZSBcInVybFwiIHBhcmFtZXRlcnMgdG8gdGhlIGNvbW1hbmRzIGluIHJldmVyc2Ugb3JkZXJcbiAgLy8gc2luY2UgdGhlIGNvbW1hbmQgd2lsbCBzb21ldGltZXMgd2FudCB0byBpZ25vcmUsIHNheSwgdGhlIHNlc3Npb25JZC5cbiAgLy8gVGhpcyBoYXMgdGhlIGVmZmVjdCBvZiBwdXR0aW5nIHNlc3Npb25JZCBsYXN0LCB3aGljaCBtZWFucyBpbiBKUyB3ZSBjYW5cbiAgLy8gb21pdCBpdCBmcm9tIHRoZSBmdW5jdGlvbiBzaWduYXR1cmUgaWYgd2UncmUgbm90IGdvaW5nIHRvIHVzZSBpdC5cbiAgbGV0IHVybFBhcmFtcyA9IF8ua2V5cyhyZXF1ZXN0UGFyYW1zKS5yZXZlcnNlKCk7XG5cbiAgLy8gSW4gdGhlIHNpbXBsZSBjYXNlLCB0aGUgcmVxdWlyZWQgcGFyYW1ldGVycyBhcmUgYSBiYXNpYyBhcnJheSBpblxuICAvLyBwYXlsb2FkUGFyYW1zLnJlcXVpcmVkLCBzbyBzdGFydCB0aGVyZS4gSXQncyBwb3NzaWJsZSB0aGF0IHRoZXJlIGFyZVxuICAvLyBtdWx0aXBsZSBvcHRpb25hbCBzZXRzIG9mIHJlcXVpcmVkIHBhcmFtcywgdGhvdWdoLCBzbyBoYW5kbGUgdGhhdCBjYXNlXG4gIC8vIHRvby5cbiAgbGV0IHJlcXVpcmVkUGFyYW1zID0gcGF5bG9hZFBhcmFtcy5yZXF1aXJlZDtcbiAgaWYgKF8uaXNBcnJheShfLmZpcnN0KHBheWxvYWRQYXJhbXMucmVxdWlyZWQpKSkge1xuICAgIC8vIElmIHRoZXJlIGFyZSBvcHRpb25hbCBzZXRzIG9mIHJlcXVpcmVkIHBhcmFtcywgdGhlbiB3ZSB3aWxsIGhhdmUgYW5cbiAgICAvLyBhcnJheSBvZiBhcnJheXMgaW4gcGF5bG9hZFBhcmFtcy5yZXF1aXJlZCwgc28gbG9vcCB0aHJvdWdoIGVhY2ggc2V0IGFuZFxuICAgIC8vIHBpY2sgdGhlIG9uZSB0aGF0IG1hdGNoZXMgd2hpY2ggSlNPTiBwYXJhbXMgd2VyZSBhY3R1YWxseSBzZW50LiBXZSd2ZVxuICAgIC8vIGFscmVhZHkgYmVlbiB0aHJvdWdoIHZhbGlkYXRpb24gc28gd2UncmUgZ3VhcmFudGVlZCB0byBmaW5kIGEgbWF0Y2guXG4gICAgbGV0IGtleXMgPSBfLmtleXMoanNvbk9iaik7XG4gICAgZm9yIChsZXQgcGFyYW1zIG9mIHBheWxvYWRQYXJhbXMucmVxdWlyZWQpIHtcbiAgICAgIGlmIChfLndpdGhvdXQocGFyYW1zLCAuLi5rZXlzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVxdWlyZWRQYXJhbXMgPSBwYXJhbXM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIE5vdyB3ZSBjb25zdHJ1Y3Qgb3VyIGxpc3Qgb2YgYXJndW1lbnRzIHdoaWNoIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBjb21tYW5kXG4gIGxldCBhcmdzO1xuICBpZiAoXy5pc0Z1bmN0aW9uKHBheWxvYWRQYXJhbXMubWFrZUFyZ3MpKSB7XG4gICAgLy8gSW4gdGhlIHJvdXRlIHNwZWMsIGEgcGFydGljdWxhciByb3V0ZSBtaWdodCBkZWZpbmUgYSAnbWFrZUFyZ3MnIGZ1bmN0aW9uXG4gICAgLy8gaWYgaXQgd2FudHMgZnVsbCBjb250cm9sIG92ZXIgaG93IHRvIHR1cm4gSlNPTiBwYXJhbWV0ZXJzIGludG8gY29tbWFuZFxuICAgIC8vIGFyZ3VtZW50cy4gU28gd2UgcGFzcyBpdCB0aGUgSlNPTiBwYXJhbWV0ZXJzIGFuZCBpdCByZXR1cm5zIGFuIGFycmF5XG4gICAgLy8gd2hpY2ggd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBoYW5kbGluZyBjb21tYW5kLiBGb3IgZXhhbXBsZSBpZiBpdCByZXR1cm5zXG4gICAgLy8gWzEsIDIsIDNdLCB3ZSB3aWxsIGNhbGwgYGNvbW1hbmQoMSwgMiwgMywgLi4uKWAgKHVybCBwYXJhbXMgYXJlIHNlcGFyYXRlXG4gICAgLy8gZnJvbSBKU09OIHBhcmFtcyBhbmQgZ2V0IGNvbmNhdGVuYXRlZCBiZWxvdykuXG4gICAgYXJncyA9IHBheWxvYWRQYXJhbXMubWFrZUFyZ3MoanNvbk9iaiwgcHJvdG9jb2wpO1xuICB9IGVsc2Uge1xuICAgIC8vIE90aGVyd2lzZSwgY29sbGVjdCBhbGwgdGhlIHJlcXVpcmVkIGFuZCBvcHRpb25hbCBwYXJhbXMgYW5kIGZsYXR0ZW4gdGhlbVxuICAgIC8vIGludG8gYW4gYXJndW1lbnQgYXJyYXlcbiAgICBhcmdzID0gXy5mbGF0dGVuKHJlcXVpcmVkUGFyYW1zKS5tYXAoKHApID0+IGpzb25PYmpbcF0pO1xuICAgIGlmIChwYXlsb2FkUGFyYW1zLm9wdGlvbmFsKSB7XG4gICAgICBhcmdzID0gYXJncy5jb25jYXQoXy5mbGF0dGVuKHBheWxvYWRQYXJhbXMub3B0aW9uYWwpLm1hcCgocCkgPT4ganNvbk9ialtwXSkpO1xuICAgIH1cbiAgfVxuICAvLyBGaW5hbGx5LCBnZXQgb3VyIHVybCBwYXJhbXMgKHNlc3Npb24gaWQsIGVsZW1lbnQgaWQsIGV0Yy4uLikgb24gdGhlIGVuZCBvZlxuICAvLyB0aGUgbGlzdFxuICBhcmdzID0gYXJncy5jb25jYXQodXJsUGFyYW1zLm1hcCgodSkgPT4gcmVxdWVzdFBhcmFtc1t1XSkpO1xuICByZXR1cm4gYXJncztcbn1cblxuZnVuY3Rpb24gcm91dGVDb25maWd1cmluZ0Z1bmN0aW9uIChkcml2ZXIpIHtcbiAgaWYgKCFkcml2ZXIuc2Vzc2lvbkV4aXN0cykge1xuICAgIHRocm93IG5ldyBFcnJvcignRHJpdmVycyB1c2VkIHdpdGggTUpTT05XUCBtdXN0IGltcGxlbWVudCBgc2Vzc2lvbkV4aXN0c2AnKTtcbiAgfVxuXG4gIGlmICghKGRyaXZlci5leGVjdXRlQ29tbWFuZCB8fCBkcml2ZXIuZXhlY3V0ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0RyaXZlcnMgdXNlZCB3aXRoIE1KU09OV1AgbXVzdCBpbXBsZW1lbnQgYGV4ZWN1dGVDb21tYW5kYCBvciBgZXhlY3V0ZWAnKTtcbiAgfVxuXG4gIC8vIHJldHVybiBhIGZ1bmN0aW9uIHdoaWNoIHdpbGwgYWRkIGFsbCB0aGUgcm91dGVzIHRvIHRoZSBkcml2ZXJcbiAgcmV0dXJuIGZ1bmN0aW9uIChhcHApIHtcbiAgICBmb3IgKGxldCBbcGF0aCwgbWV0aG9kc10gb2YgXy50b1BhaXJzKE1FVEhPRF9NQVApKSB7XG4gICAgICBmb3IgKGxldCBbbWV0aG9kLCBzcGVjXSBvZiBfLnRvUGFpcnMobWV0aG9kcykpIHtcbiAgICAgICAgLy8gc2V0IHVwIHRoZSBleHByZXNzIHJvdXRlIGhhbmRsZXJcbiAgICAgICAgYnVpbGRIYW5kbGVyKGFwcCwgbWV0aG9kLCBwYXRoLCBzcGVjLCBkcml2ZXIsIGlzU2Vzc2lvbkNvbW1hbmQoc3BlYy5jb21tYW5kKSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZEhhbmRsZXIgKGFwcCwgbWV0aG9kLCBwYXRoLCBzcGVjLCBkcml2ZXIsIGlzU2Vzc0NtZCkge1xuICBsZXQgYXN5bmNIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgbGV0IGpzb25PYmogPSByZXEuYm9keTtcbiAgICBsZXQgaHR0cFJlc0JvZHkgPSB7fTtcbiAgICBsZXQgaHR0cFN0YXR1cyA9IDIwMDtcbiAgICBsZXQgbmV3U2Vzc2lvbklkO1xuICAgIGxldCBpc1czQztcbiAgICBsZXQgaXNNSlNPTldQO1xuXG4gICAgLy8gZ2V0IHRoZSBhcHByb3ByaWF0ZSBsb2dnZXIgZGVwZW5kaW5nIG9uIHRoZSBwcm90b2NvbCB0aGF0IGlzIGJlaW5nIHVzZWRcbiAgICBjb25zdCBsb2cgPSBnZXRMb2dCeVByb3RvY29sKGRyaXZlcik7XG5cbiAgICB0cnkge1xuICAgICAgLy8gaWYgdGhpcyBpcyBhIHNlc3Npb24gY29tbWFuZCBidXQgd2UgZG9uJ3QgaGF2ZSBhIHNlc3Npb24sXG4gICAgICAvLyBlcnJvciBvdXQgZWFybHkgKGVzcGVjaWFsbHkgYmVmb3JlIHByb3h5aW5nKVxuICAgICAgaWYgKGlzU2Vzc0NtZCAmJiAhZHJpdmVyLnNlc3Npb25FeGlzdHMocmVxLnBhcmFtcy5zZXNzaW9uSWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuTm9TdWNoRHJpdmVyRXJyb3IoKTtcbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhlIGRyaXZlciBpcyBjdXJyZW50bHkgcHJveHlpbmcgY29tbWFuZHMgdG8gYW5vdGhlciBKU09OV1BcbiAgICAgIC8vIHNlcnZlciwgYnlwYXNzIGFsbCBvdXIgY2hlY2tzIGFuZCBhc3N1bWUgdGhlIHVwc3RyZWFtIHNlcnZlciBrbm93c1xuICAgICAgLy8gd2hhdCBpdCdzIGRvaW5nLiBCdXQga2VlcCB0aGlzIGluIHRoZSB0cnkvY2F0Y2ggYmxvY2sgc28gaWYgcHJveHlpbmdcbiAgICAgIC8vIGl0c2VsZiBmYWlscywgd2UgZ2l2ZSBhIG1lc3NhZ2UgdG8gdGhlIGNsaWVudC4gT2YgY291cnNlIHdlIG9ubHlcbiAgICAgIC8vIHdhbnQgdG8gZG8gdGhlc2Ugd2hlbiB3ZSBoYXZlIGEgc2Vzc2lvbiBjb21tYW5kOyB0aGUgQXBwaXVtIGRyaXZlclxuICAgICAgLy8gbXVzdCBiZSByZXNwb25zaWJsZSBmb3Igc3RhcnQvc3RvcCBzZXNzaW9uLCBldGMuLi5cbiAgICAgIGlmIChpc1Nlc3NDbWQgJiYgZHJpdmVyU2hvdWxkRG9Kd3BQcm94eShkcml2ZXIsIHJlcSwgc3BlYy5jb21tYW5kKSkge1xuICAgICAgICBhd2FpdCBkb0p3cFByb3h5KGRyaXZlciwgcmVxLCByZXMpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIGEgY29tbWFuZCBpcyBub3QgaW4gb3VyIG1ldGhvZCBtYXAsIGl0J3MgYmVjYXVzZSB3ZVxuICAgICAgLy8gaGF2ZSBubyBwbGFucyB0byBldmVyIGltcGxlbWVudCBpdFxuICAgICAgaWYgKCFzcGVjLmNvbW1hbmQpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5Ob3RJbXBsZW1lbnRlZEVycm9yKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIHdyYXAgcGFyYW1zIGlmIG5lY2Vzc2FyeVxuICAgICAgaWYgKHNwZWMucGF5bG9hZFBhcmFtcyAmJiBzcGVjLnBheWxvYWRQYXJhbXMud3JhcCkge1xuICAgICAgICBqc29uT2JqID0gd3JhcFBhcmFtcyhzcGVjLnBheWxvYWRQYXJhbXMsIGpzb25PYmopO1xuICAgICAgfVxuXG4gICAgICAvLyB1bndyYXAgcGFyYW1zIGlmIG5lY2Vzc2FyeVxuICAgICAgaWYgKHNwZWMucGF5bG9hZFBhcmFtcyAmJiBzcGVjLnBheWxvYWRQYXJhbXMudW53cmFwKSB7XG4gICAgICAgIGpzb25PYmogPSB1bndyYXBQYXJhbXMoc3BlYy5wYXlsb2FkUGFyYW1zLCBqc29uT2JqKTtcbiAgICAgIH1cblxuICAgICAgLy8gZW5zdXJlIHRoYXQgdGhlIGpzb24gcGF5bG9hZCBjb25mb3JtcyB0byB0aGUgc3BlY1xuICAgICAgY2hlY2tQYXJhbXMoc3BlYy5wYXlsb2FkUGFyYW1zLCBqc29uT2JqLCBkcml2ZXIucHJvdG9jb2wpO1xuICAgICAgLy8gZW5zdXJlIHRoZSBzZXNzaW9uIHRoZSB1c2VyIGlzIHRyeWluZyB0byB1c2UgaXMgdmFsaWRcblxuICAgICAgLy8gdHVybiB0aGUgY29tbWFuZCBhbmQganNvbiBwYXlsb2FkIGludG8gYW4gYXJndW1lbnQgbGlzdCBmb3JcbiAgICAgIC8vIHRoZSBkcml2ZXIgbWV0aG9kc1xuICAgICAgbGV0IGFyZ3MgPSBtYWtlQXJncyhyZXEucGFyYW1zLCBqc29uT2JqLCBzcGVjLnBheWxvYWRQYXJhbXMgfHwge30sIGRyaXZlci5wcm90b2NvbCk7XG4gICAgICBsZXQgZHJpdmVyUmVzO1xuICAgICAgLy8gdmFsaWRhdGUgY29tbWFuZCBhcmdzIGFjY29yZGluZyB0byBNSlNPTldQXG4gICAgICBpZiAodmFsaWRhdG9yc1tzcGVjLmNvbW1hbmRdKSB7XG4gICAgICAgIHZhbGlkYXRvcnNbc3BlYy5jb21tYW5kXSguLi5hcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gcnVuIHRoZSBkcml2ZXIgY29tbWFuZCB3cmFwcGVkIGluc2lkZSB0aGUgYXJndW1lbnQgdmFsaWRhdG9yc1xuICAgICAgbG9nLmRlYnVnKGBDYWxsaW5nICR7ZHJpdmVyLmNvbnN0cnVjdG9yLm5hbWV9LiR7c3BlYy5jb21tYW5kfSgpIHdpdGggYXJnczogYCArXG4gICAgICAgICAgICAgICAgXy50cnVuY2F0ZShKU09OLnN0cmluZ2lmeShhcmdzKSwge2xlbmd0aDogTE9HX09CSl9MRU5HVEh9KSk7XG5cbiAgICAgIGlmIChkcml2ZXIuZXhlY3V0ZUNvbW1hbmQpIHtcbiAgICAgICAgZHJpdmVyUmVzID0gYXdhaXQgZHJpdmVyLmV4ZWN1dGVDb21tYW5kKHNwZWMuY29tbWFuZCwgLi4uYXJncyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkcml2ZXJSZXMgPSBhd2FpdCBkcml2ZXIuZXhlY3V0ZShzcGVjLmNvbW1hbmQsIC4uLmFyZ3MpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIHByb3RvY29sIGFmdGVyIGV4ZWN1dGVDb21tYW5kICh3aGVuIGNvbW1hbmQgaXMgYGNyZWF0ZVNlc3Npb25gLCBwcm90b2NvbCBpcyBhc3NpZ25lZCB3aXRoaW5cbiAgICAgIC8vIGNyZWF0ZVNlc3Npb24gZnVuY3Rpb24pXG4gICAgICBpc1czQyA9IGRyaXZlci5pc1czQ1Byb3RvY29sKCk7XG4gICAgICBpc01KU09OV1AgPSBkcml2ZXIuaXNNanNvbndwUHJvdG9jb2woKTtcblxuICAgICAgLy8gSWYgYGV4ZWN1dGVDb21tYW5kYCB3YXMgb3ZlcnJpZGRlbiBhbmQgdGhlIG1ldGhvZCByZXR1cm5zIGFuIG9iamVjdFxuICAgICAgLy8gd2l0aCBhIHByb3RvY29sIGFuZCB2YWx1ZS9lcnJvciBwcm9wZXJ0eSwgcmUtYXNzaWduIHRoZSBwcm90b2NvbFxuICAgICAgY29uc3QgcGFyc2VkRHJpdmVyUmVzID0gcGFyc2VQcm90b2NvbChkcml2ZXJSZXMpO1xuICAgICAgaWYgKHBhcnNlZERyaXZlclJlcykge1xuICAgICAgICBpc1czQyA9IHBhcnNlZERyaXZlclJlcy5pc1czQztcbiAgICAgICAgaXNNSlNPTldQID0gcGFyc2VkRHJpdmVyUmVzLmlzTUpTT05XUDtcbiAgICAgICAgaWYgKHBhcnNlZERyaXZlclJlcy5lcnJvcikge1xuICAgICAgICAgIHRocm93IHBhcnNlZERyaXZlclJlcy5lcnJvcjtcbiAgICAgICAgfVxuICAgICAgICBkcml2ZXJSZXMgPSBwYXJzZWREcml2ZXJSZXMudmFsdWU7XG4gICAgICB9XG5cbiAgICAgIC8vIFVzZSB0aGUgbG9nZ2VyIHRoYXQncyBzcGVjaWZpYyB0byB0aGlzIHJlc3BvbnNlXG4gICAgICBjb25zdCBwcm90b2NvbExvZ2dlciA9IGlzVzNDID8gdzNjTG9nIDogbWpzb253cExvZztcblxuICAgICAgLy8gdW5wYWNrIGNyZWF0ZVNlc3Npb24gcmVzcG9uc2VcbiAgICAgIGlmIChzcGVjLmNvbW1hbmQgPT09ICdjcmVhdGVTZXNzaW9uJykge1xuICAgICAgICBuZXdTZXNzaW9uSWQgPSBkcml2ZXJSZXNbMF07XG4gICAgICAgIGlmIChpc01KU09OV1ApIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSBkcml2ZXJSZXNbMV07XG4gICAgICAgIH0gZWxzZSBpZiAoaXNXM0MpIHtcbiAgICAgICAgICBkcml2ZXJSZXMgPSB7XG4gICAgICAgICAgICBjYXBhYmlsaXRpZXM6IGRyaXZlclJlc1sxXSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZSBNSlNPTldQIGVsZW1lbnQga2V5IGZvcm1hdCAoRUxFTUVOVCkgd2FzIHByb3ZpZGVkIHRyYW5zbGF0ZSBpdCB0byBXM0MgZWxlbWVudCBrZXkgZm9ybWF0IChlbGVtZW50LTYwNjYtMTFlNC1hNTJlLTRmNzM1NDY2Y2VjZilcbiAgICAgIC8vIGFuZCB2aWNlLXZlcnNhXG4gICAgICBpZiAoZHJpdmVyUmVzKSB7XG4gICAgICAgIGlmIChpc1czQykge1xuICAgICAgICAgIGRyaXZlclJlcyA9IHJlbmFtZUtleShkcml2ZXJSZXMsIE1KU09OV1BfRUxFTUVOVF9LRVksIFczQ19FTEVNRU5UX0tFWSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZHJpdmVyUmVzID0gcmVuYW1lS2V5KGRyaXZlclJlcywgVzNDX0VMRU1FTlRfS0VZLCBNSlNPTldQX0VMRU1FTlRfS0VZKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG5cbiAgICAgIC8vIGNvbnZlcnQgdW5kZWZpbmVkIHRvIG51bGwsIGJ1dCBsZWF2ZSBhbGwgb3RoZXIgdmFsdWVzIHRoZSBzYW1lXG4gICAgICBpZiAoXy5pc1VuZGVmaW5lZChkcml2ZXJSZXMpKSB7XG4gICAgICAgIGRyaXZlclJlcyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIGRlbGV0ZSBzaG91bGQgbm90IHJldHVybiBhbnl0aGluZyBldmVuIGlmIHN1Y2Nlc3NmdWxcbiAgICAgIGlmIChzcGVjLmNvbW1hbmQgPT09ICdkZWxldGVTZXNzaW9uJykge1xuICAgICAgICBwcm90b2NvbExvZ2dlci5kZWJ1ZyhgUmVjZWl2ZWQgcmVzcG9uc2U6ICR7Xy50cnVuY2F0ZShKU09OLnN0cmluZ2lmeShkcml2ZXJSZXMpLCB7bGVuZ3RoOiBMT0dfT0JKX0xFTkdUSH0pfWApO1xuICAgICAgICBwcm90b2NvbExvZ2dlci5kZWJ1ZygnQnV0IGRlbGV0aW5nIHNlc3Npb24sIHNvIG5vdCByZXR1cm5pbmcnKTtcbiAgICAgICAgZHJpdmVyUmVzID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhlIHN0YXR1cyBpcyBub3QgMCwgIHRocm93IHRoZSBhcHByb3ByaWF0ZSBlcnJvciBmb3Igc3RhdHVzIGNvZGUuXG4gICAgICBpZiAodXRpbC5oYXNWYWx1ZShkcml2ZXJSZXMpKSB7XG4gICAgICAgIGlmICh1dGlsLmhhc1ZhbHVlKGRyaXZlclJlcy5zdGF0dXMpICYmICFpc05hTihkcml2ZXJSZXMuc3RhdHVzKSAmJiBwYXJzZUludChkcml2ZXJSZXMuc3RhdHVzLCAxMCkgIT09IDApIHtcbiAgICAgICAgICB0aHJvdyBlcnJvckZyb21NSlNPTldQU3RhdHVzQ29kZShkcml2ZXJSZXMuc3RhdHVzLCBkcml2ZXJSZXMudmFsdWUpO1xuICAgICAgICB9IGVsc2UgaWYgKF8uaXNQbGFpbk9iamVjdChkcml2ZXJSZXMudmFsdWUpICYmIGRyaXZlclJlcy52YWx1ZS5lcnJvcikge1xuICAgICAgICAgIHRocm93IGVycm9yRnJvbVczQ0pzb25Db2RlKGRyaXZlclJlcy52YWx1ZS5lcnJvciwgZHJpdmVyUmVzLnZhbHVlLm1lc3NhZ2UsIGRyaXZlclJlcy52YWx1ZS5zdGFja3RyYWNlKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBSZXNwb25zZSBzdGF0dXMgc2hvdWxkIGJlIHRoZSBzdGF0dXMgc2V0IGJ5IHRoZSBkcml2ZXIgcmVzcG9uc2UuXG4gICAgICBpZiAoIWlzVzNDKSB7XG4gICAgICAgIGh0dHBSZXNCb2R5LnN0YXR1cyA9IChfLmlzTmlsKGRyaXZlclJlcykgfHwgXy5pc1VuZGVmaW5lZChkcml2ZXJSZXMuc3RhdHVzKSkgPyBKU09OV1BfU1VDQ0VTU19TVEFUVVNfQ09ERSA6IGRyaXZlclJlcy5zdGF0dXM7XG4gICAgICB9XG4gICAgICBodHRwUmVzQm9keS52YWx1ZSA9IGRyaXZlclJlcztcbiAgICAgIHByb3RvY29sTG9nZ2VyLmRlYnVnKGBSZXNwb25kaW5nIHRvIGNsaWVudCB3aXRoIGRyaXZlci4ke3NwZWMuY29tbWFuZH0oKSBgICtcbiAgICAgICAgICAgICAgIGByZXN1bHQ6ICR7Xy50cnVuY2F0ZShKU09OLnN0cmluZ2lmeShkcml2ZXJSZXMpLCB7bGVuZ3RoOiBMT0dfT0JKX0xFTkdUSH0pfWApO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLy8gaWYgYW55dGhpbmcgZ29lcyB3cm9uZywgZmlndXJlIG91dCB3aGF0IG91ciByZXNwb25zZSBzaG91bGQgYmVcbiAgICAgIC8vIGJhc2VkIG9uIHRoZSB0eXBlIG9mIGVycm9yIHRoYXQgd2UgZW5jb3VudGVyZWRcbiAgICAgIGxldCBhY3R1YWxFcnIgPSBlcnI7XG5cbiAgICAgIGlmIChfLmlzVW5kZWZpbmVkKGlzTUpTT05XUCkpIHtcbiAgICAgICAgaXNNSlNPTldQID0gZHJpdmVyLmlzTWpzb253cFByb3RvY29sKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChfLmlzVW5kZWZpbmVkKGlzVzNDKSkge1xuICAgICAgICBpc1czQyA9IGRyaXZlci5pc1czQ1Byb3RvY29sKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFVzZSB0aGUgbG9nZ2VyIHRoYXQncyBzcGVjaWZpYyB0byB0aGlzIHJlc3BvbnNlXG4gICAgICBjb25zdCBwcm90b2NvbExvZ2dlciA9IGlzVzNDID8gdzNjTG9nIDogbWpzb253cExvZztcblxuICAgICAgaWYgKGlzRXJyb3JUeXBlKGVyciwgZXJyb3JzLlByb3h5UmVxdWVzdEVycm9yKSkge1xuICAgICAgICBwcm90b2NvbExvZ2dlci5lcnJvcihgRW5jb3VudGVyZWQgaW50ZXJuYWwgZXJyb3IgcnVubmluZyBjb21tYW5kOiAgJHtKU09OLnN0cmluZ2lmeShlcnIpfSAke2Vyci5zdGFja31gKTtcbiAgICAgICAgYWN0dWFsRXJyID0gZXJyLmdldEFjdHVhbEVycm9yKCk7XG4gICAgICB9IGVsc2UgaWYgKCFpc1czQyAmJiAoIShpc0Vycm9yVHlwZShlcnIsIFByb3RvY29sRXJyb3IpIHx8IGlzRXJyb3JUeXBlKGVyciwgZXJyb3JzLkJhZFBhcmFtZXRlcnNFcnJvcikpKSkge1xuICAgICAgICBwcm90b2NvbExvZ2dlci5lcnJvcihgRW5jb3VudGVyZWQgaW50ZXJuYWwgZXJyb3IgcnVubmluZyBjb21tYW5kOiAke2Vyci5zdGFja3RyYWNlIHx8IGVyci5zdGFja31gKTtcbiAgICAgICAgYWN0dWFsRXJyID0gbmV3IGVycm9ycy5Vbmtub3duRXJyb3IoZXJyKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGlzVzNDKSB7XG4gICAgICAgIFtodHRwU3RhdHVzLCBodHRwUmVzQm9keV0gPSBnZXRSZXNwb25zZUZvclczQ0Vycm9yKGFjdHVhbEVycik7XG4gICAgICB9IGVsc2UgaWYgKGlzTUpTT05XUCkge1xuICAgICAgICBbaHR0cFN0YXR1cywgaHR0cFJlc0JvZHldID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgaXQncyB1bmtub3duIHdoYXQgdGhlIHByb3RvY29sIGlzIChsaWtlIGlmIGl0J3MgYGdldFN0YXR1c2AgcHJpb3IgdG8gYGNyZWF0ZVNlc3Npb25gKSwgbWVyZ2UgdGhlIHJlc3BvbnNlc1xuICAgICAgICAvLyB0b2dldGhlciB0byBiZSBwcm90b2NvbC1hZ25vc3RpY1xuICAgICAgICBsZXQganNvbndwUmVzID0gZ2V0UmVzcG9uc2VGb3JKc29ud3BFcnJvcihhY3R1YWxFcnIpO1xuICAgICAgICBsZXQgdzNjUmVzID0gZ2V0UmVzcG9uc2VGb3JXM0NFcnJvcihhY3R1YWxFcnIpO1xuXG4gICAgICAgIGh0dHBSZXNCb2R5ID0ge1xuICAgICAgICAgIC4uLmpzb253cFJlc1sxXSxcbiAgICAgICAgICAuLi53M2NSZXNbMV0sXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVXNlIHRoZSBKU09OV1Agc3RhdHVzIGNvZGUgKHdoaWNoIGlzIHVzdWFsbHkgNTAwKVxuICAgICAgICBodHRwU3RhdHVzID0ganNvbndwUmVzWzBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGRlY29kZSB0aGUgcmVzcG9uc2UsIHdoaWNoIGlzIGVpdGhlciBhIHN0cmluZyBvciBqc29uXG4gICAgaWYgKF8uaXNTdHJpbmcoaHR0cFJlc0JvZHkpKSB7XG4gICAgICByZXMuc3RhdHVzKGh0dHBTdGF0dXMpLnNlbmQoaHR0cFJlc0JvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobmV3U2Vzc2lvbklkKSB7XG4gICAgICAgIGlmIChpc1czQykge1xuICAgICAgICAgIGh0dHBSZXNCb2R5LnZhbHVlLnNlc3Npb25JZCA9IG5ld1Nlc3Npb25JZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBodHRwUmVzQm9keS5zZXNzaW9uSWQgPSBuZXdTZXNzaW9uSWQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGh0dHBSZXNCb2R5LnNlc3Npb25JZCA9IHJlcS5wYXJhbXMuc2Vzc2lvbklkIHx8IG51bGw7XG4gICAgICB9XG5cbiAgICAgIC8vIERvbid0IGluY2x1ZGUgc2Vzc2lvbklkIGluIFczQyByZXNwb25zZXNcbiAgICAgIGlmIChpc1czQykge1xuICAgICAgICBkZWxldGUgaHR0cFJlc0JvZHkuc2Vzc2lvbklkO1xuICAgICAgfVxuICAgICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzKS5qc29uKGh0dHBSZXNCb2R5KTtcbiAgICB9XG4gIH07XG4gIC8vIGFkZCB0aGUgbWV0aG9kIHRvIHRoZSBhcHBcbiAgYXBwW21ldGhvZC50b0xvd2VyQ2FzZSgpXShwYXRoLCAocmVxLCByZXMpID0+IHtcbiAgICBCLnJlc29sdmUoYXN5bmNIYW5kbGVyKHJlcSwgcmVzKSkuZG9uZSgpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZHJpdmVyU2hvdWxkRG9Kd3BQcm94eSAoZHJpdmVyLCByZXEsIGNvbW1hbmQpIHtcbiAgLy8gZHJpdmVycyBuZWVkIHRvIGV4cGxpY2l0bHkgc2F5IHdoZW4gdGhlIHByb3h5IGlzIGFjdGl2ZVxuICBpZiAoIWRyaXZlci5wcm94eUFjdGl2ZShyZXEucGFyYW1zLnNlc3Npb25JZCkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB3ZSBzaG91bGQgbmV2ZXIgcHJveHkgZGVsZXRlU2Vzc2lvbiBiZWNhdXNlIHdlIG5lZWQgdG8gZ2l2ZSB0aGUgY29udGFpbmluZ1xuICAvLyBkcml2ZXIgYW4gb3Bwb3J0dW5pdHkgdG8gY2xlYW4gaXRzZWxmIHVwXG4gIGlmIChjb21tYW5kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyB2YWxpZGF0ZSBhdm9pZGFuY2Ugc2NoZW1hLCBhbmQgc2F5IHdlIHNob3VsZG4ndCBwcm94eSBpZiBhbnl0aGluZyBpbiB0aGVcbiAgLy8gYXZvaWQgbGlzdCBtYXRjaGVzIG91ciByZXFcbiAgbGV0IHByb3h5QXZvaWRMaXN0ID0gZHJpdmVyLmdldFByb3h5QXZvaWRMaXN0KHJlcS5wYXJhbXMuc2Vzc2lvbklkKTtcbiAgZm9yIChsZXQgYXZvaWRTY2hlbWEgb2YgcHJveHlBdm9pZExpc3QpIHtcbiAgICBpZiAoIV8uaXNBcnJheShhdm9pZFNjaGVtYSkgfHwgYXZvaWRTY2hlbWEubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb3h5IGF2b2lkYW5jZSBtdXN0IGJlIGEgbGlzdCBvZiBwYWlycycpO1xuICAgIH1cbiAgICBsZXQgW2F2b2lkTWV0aG9kLCBhdm9pZFBhdGhSZWdleF0gPSBhdm9pZFNjaGVtYTtcbiAgICBpZiAoIV8uaW5jbHVkZXMoWydHRVQnLCAnUE9TVCcsICdERUxFVEUnXSwgYXZvaWRNZXRob2QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBwcm94eSBhdm9pZGFuY2UgbWV0aG9kICcke2F2b2lkTWV0aG9kfSdgKTtcbiAgICB9XG4gICAgaWYgKCEoYXZvaWRQYXRoUmVnZXggaW5zdGFuY2VvZiBSZWdFeHApKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb3h5IGF2b2lkYW5jZSBwYXRoIG11c3QgYmUgYSByZWd1bGFyIGV4cHJlc3Npb24nKTtcbiAgICB9XG4gICAgbGV0IG5vcm1hbGl6ZWRVcmwgPSByZXEub3JpZ2luYWxVcmwucmVwbGFjZSgvXlxcL3dkXFwvaHViLywgJycpO1xuICAgIGlmIChhdm9pZE1ldGhvZCA9PT0gcmVxLm1ldGhvZCAmJiBhdm9pZFBhdGhSZWdleC50ZXN0KG5vcm1hbGl6ZWRVcmwpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRvSndwUHJveHkgKGRyaXZlciwgcmVxLCByZXMpIHtcbiAgZ2V0TG9nQnlQcm90b2NvbChkcml2ZXIpLmluZm8oJ0RyaXZlciBwcm94eSBhY3RpdmUsIHBhc3NpbmcgcmVxdWVzdCBvbiB2aWEgSFRUUCBwcm94eScpO1xuXG4gIC8vIGNoZWNrIHRoYXQgdGhlIGlubmVyIGRyaXZlciBoYXMgYSBwcm94eSBmdW5jdGlvblxuICBpZiAoIWRyaXZlci5jYW5Qcm94eShyZXEucGFyYW1zLnNlc3Npb25JZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1RyeWluZyB0byBwcm94eSB0byBhIEpTT05XUCBzZXJ2ZXIgYnV0IGRyaXZlciBpcyB1bmFibGUgdG8gcHJveHknKTtcbiAgfVxuICB0cnkge1xuICAgIGNvbnN0IHByb3hpZWRSZXMgPSBhd2FpdCBkcml2ZXIuZXhlY3V0ZUNvbW1hbmQoJ3Byb3h5UmVxUmVzJywgcmVxLCByZXMsIHJlcS5wYXJhbXMuc2Vzc2lvbklkKTtcbiAgICBpZiAocHJveGllZFJlcyAmJiBwcm94aWVkUmVzLmVycm9yKSB0aHJvdyBwcm94aWVkUmVzLmVycm9yOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGN1cmx5XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChpc0Vycm9yVHlwZShlcnIsIGVycm9ycy5Qcm94eVJlcXVlc3RFcnJvcikpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgcHJveHkuIFByb3h5IGVycm9yOiAke2Vyci5tZXNzYWdlfWApO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGEgZHJpdmVyIGNvbW1hbmQgcmVzcG9uZCBhbmQgc2VlIGlmIHRoZSBwcm90b2NvbCBhbmQgdmFsdWUgd2FzIHBhc3NlZCBpblxuICogQHBhcmFtIHtPYmplY3R9IGRyaXZlclJlcyBSZXNwb25zZSByZXR1cm5lZCBieSBgZXhlY3V0ZUNvbW1hbmRgIGluIGFuIGlubmVyIGRyaXZlclxuICogQHJldHVybnMgez9PYmplY3R9IE9iamVjdCBvZiB0aGUgZm9ybSB7aXNXM0MsIGlzTUpTT05XUCwgdmFsdWV8ZXJyb3J9IG9yIG51bGwgaWYgaXQgaXNuJ3QgcGFyc2FibGVcbiAqL1xuZnVuY3Rpb24gcGFyc2VQcm90b2NvbCAoZHJpdmVyUmVzKSB7XG4gIGlmICghXy5pc1BsYWluT2JqZWN0KGRyaXZlclJlcykgfHwgIV8uaXNTdHJpbmcoZHJpdmVyUmVzLnByb3RvY29sKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbGV0IGlzVzNDID0gZHJpdmVyUmVzLnByb3RvY29sID09PSBCYXNlRHJpdmVyLkRSSVZFUl9QUk9UT0NPTC5XM0M7XG4gIGxldCBpc01KU09OV1AgPSBkcml2ZXJSZXMucHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLk1KU09OV1A7XG5cbiAgaWYgKF8uaGFzKGRyaXZlclJlcywgJ3ZhbHVlJykpIHtcbiAgICByZXR1cm4ge2lzVzNDLCBpc01KU09OV1AsIHZhbHVlOiBkcml2ZXJSZXMudmFsdWV9O1xuICB9XG5cbiAgaWYgKF8uaXNFcnJvcihkcml2ZXJSZXMuZXJyb3IpKSB7XG4gICAgcmV0dXJuIHtpc1czQywgaXNNSlNPTldQLCBlcnJvcjogZHJpdmVyUmVzLmVycm9yfTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufVxuXG5cbmV4cG9ydCB7IFByb3RvY29sLCByb3V0ZUNvbmZpZ3VyaW5nRnVuY3Rpb24sIGlzU2Vzc2lvbkNvbW1hbmQsIE1KU09OV1BfRUxFTUVOVF9LRVksIFczQ19FTEVNRU5UX0tFWSwgcGFyc2VQcm90b2NvbCB9O1xuIl0sInNvdXJjZVJvb3QiOiIuLi8uLi8uLiJ9
