// load node modules
var events = require("events");

// load npm modules
var Class = require("node-oo");


// simply convert prototype-style classes and export them
module.exports = {
  Emitter: Class._convert(events.EventEmitter, "__emitter")
};
