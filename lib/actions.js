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


module.exports = function(stepMapping) {

  var instances = {};
  var actions = {};

  Object.keys(stepMapping).forEach(function(step) {
    var data = stepMapping[step];
    
    var instance = instances[data.class];
    if (!instance)
      instance = instances[data.class] = new AWS[data.class]();

    actions[step] = createAction(instance, data.method);
  });

  return actions;
};
