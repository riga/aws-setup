// load npm modules
var winston = require("winston");


var config = {
  levels: {
    all    : 0,
    debug  : 2,
    info   : 4,
    warning: 6,
    error  : 8,
    fatal  : 10
  },
  colors: {
    all    : "grey",
    debug  : "blue",
    info   : "green",
    warning: "yellow",
    error  : "red",
    fatal  : "red"
  }
};


module.exports = function(level) {
  level = level || "debug";

  return new winston.Logger({
    levels: config.levels,
    colors: config.colors,
    transports: [
      new winston.transports.Console({
        level: level,
        colorize: true
      })
    ]
  });
};
