// load npm modules
var extend = require("node.extend"),
    AWS    = require("aws-sdk");


// creates callbacks for AWS calls
var requestCallback = function(callback, log, err) {
  if (err)
    log("%s (%s, %s)", err.message, err.statusCode, err.name);
  if (callback)
    callback(null);
};


// creates AWS actions/calls that are compatible to async
var createAction = function(instance, method) {
  return function(config, callback, log) {
    instance[method](config, requestCallback.bind(null, callback, log));
  };
};

// instance and actions cache
var instances = {};
var actions = {};


module.exports = function(stepMapping, step) {

  if (actions[step])
    return actions[step];

  var data = stepMapping[step];

  var instance = instances[data.class];
  if (!instance)
    instance = instances[data.class] = new AWS[data.class]();

  return actions[step] = createAction(instance, data.method);
};
