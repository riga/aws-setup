// load node modules
var fs = require("fs");


var formatters = {
  base64: function(val) {
    return new Buffer(val).toString("base64");
  },

  keyGen: function(n) {
    n = parseInt(n) || 10;
    var key = "";
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < n; ++i)
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    return key;
  },

  script: function(path) {
    var args = Array.prototype.slice.call(arguments, 1);

    if (!fs.existsSync(path))
      return "";

    // read the file
    var content = fs.readFileSync(path).toString();

    // remove comments, except #!
    var lines = [];
    content.split("\n").forEach(function(line) {
      if (line.trim()[0] != "#" || line.trim()[1] == "!")
        lines.push(line);
    });
    content = lines.join("\n");

    // prepend additional lines from args
    if (args.length)
      content = "#!\n" + args.join("\n") + "\n\n" + content;

    return content;
  },

  script64: function() {
    var content = formatters.script.apply(formatters, arguments);
    return formatters.base64(content);
  }
};


module.exports = formatters;
