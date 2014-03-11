// load npm modules
var extend = require("node.extend"),
    AWS    = require("aws-sdk");


// creates callbacks for AWS calls
var requestCallback = function(onSuccess, onError, callback, err) {
  if (err)
    onError(err);
  else
    onSuccess();
  callback(null);
};


// creates AWS actions/calls that are compatible to async
var createAction = function(instance, method) {
  return function(config, onSuccess, onError, callback) {
    instance[method](config, requestCallback.bind(null, onSuccess, onError, callback));
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
