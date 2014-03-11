// load node modules
var fs   = require("fs"),
    path = require("path");

// load npm modules
var cli = require("commander");


// define formatters
var noFormat = function(val) {
  return val;
};
var list = function(val) {
  return val.split(",");
};
var multiList = function(val) {
  return val.split(":").map(list);
};
var lower = function(val) {
  return val.toLowerCase();
};
var userPath = function(val) {
  var home = process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"];
  ["~", "$HOME", "%USERPROFILE%"].forEach(function(s) {
    if (val.substr(0, s.length) == s)
      val = home + val.substr(s.length);
  });
  return val;
};
var payload = function(val) {
  var p = {};
  list(val).forEach(function(elem) {
    var parts = elem.split("=");
    if (parts.length < 2)
      return;
    var key = parts.shift();
    var value = parts.join("=");
    p[key] = value;
  });
  return p;
};

var args = [
  {
    name: "-c, --credentials-file [FILE]",
    desc: "The location of your AWS credentials, default: ~/.aws/credentials.json",
    dflt: userPath("~/.aws/credentials.json"),
    frmt: userPath
  } ,{
    name: "-d, --setups-dir [DIR]",
    desc: "The location of your setups/ folder, default: ./setups",
    dflt: "./setups",
    frmt: userPath
  }, {
    name: "-i, --setup-file [FILE]",
    desc: "The setup file, relative to <setups-dir> (no file extension -> json > js), \
default: setup.(json|js)",
    dflt: "setup",
    frmt: userPath
  }, {
    name: "-m, --step-map [FILE]",
    desc: "An additional step mapping json file, relative to <setups-dir>, default: stepmap.json",
    dflt: "stepmap.json",
    frmt: userPath
  }, {
    name: "-f, --formatters [FILE]",
    desc: "An additional file containing formatters, relative to <setups-dir>, \
default: formatters.js",
    dflt: "formatters.js",
    frmt: userPath
  }, {
    name: "-g, --group [NAME[,...]]",
    desc: "The group to setup, accepts a list, default: all groups",
    frmt: list
  }, {
    name: "-s, --steps [NAME[,...]]",
    desc: "The steps to execute, accepts a list (,) or a list of lists (:), default: all steps",
    frmt: multiList
  }, {
    name: "-p, --payload [KEY=VALUE,[...]]",
    desc: "Payload that is parsed into your definitions",
    frmt: payload,
    dflt: {}
  }, {
    name: "-l, --log-level [LEVEL]",
    desc: "The log level, {all,debug,info,warning,error,fatal}, default: info",
    frmt: lower,
    dflt: "debug"
  }, {
    name: "-e, --execute",
    desc: "Execute without prompting"
  }
];

args.forEach(function(arg) {
  cli.option(arg.name, arg.desc, arg.frmt || noFormat, arg.dflt);
});


module.exports = function(argv) {
  var packageContent = fs.readFileSync(path.join("..", "package.json"));
  var version = JSON.parse(packageContent).version;
  return cli.version(version).parse(argv);
};
