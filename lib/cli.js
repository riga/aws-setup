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
var num = function(val) {
  return parseFloat(val);
};

var args = [
  {
    name: "-d, --setups-dir [DIR]",
    desc: "the location of your setups/ folder, default: ./setups",
    dflt: "./setups",
    frmt: userPath
  }, {
    name: "-i, --setup-file [FILE]",
    desc: "the setup file, relative to <setups-dir> (no file extension -> json > js), \
default: setup.(json|js)",
    dflt: "setup",
    frmt: userPath
  }, {
    name: "-m, --step-map [FILE]",
    desc: "an additional step mapping json file, relative to <setups-dir>, default: stepmap.json",
    dflt: "stepmap.json",
    frmt: userPath
  }, {
    name: "-f, --formatters [FILE]",
    desc: "an additional file containing formatters, relative to <setups-dir>, \
default: formatters.js",
    dflt: "formatters.js",
    frmt: userPath
  }, {
    name: "-g, --group [NAME[,...]]",
    desc: "the group to setup, accepts a list, default: all groups",
    frmt: list
  }, {
    name: "-s, --steps [NAME[,...]]",
    desc: "the steps to execute, accepts a list (,) or a list of lists (:), default: all steps",
    frmt: multiList
  }, {
    name: "-p, --payload [KEY=VALUE,[...]]",
    desc: "payload that is parsed into your definitions",
    frmt: payload,
    dflt: {}
  }, {
    name: "-c, --config-file [FILE]",
    desc: "the location of your AWS config/credentials, \
environment variables are used when missing",
    frmt: userPath
  }, {
    name: "-t, --timeout [SECONDS]",
    desc: "adds delays between the execution of steps, default: 0",
    frmt: num,
    dflt: 0
  }, {
    name: "-l, --log-level [LEVEL]",
    desc: "the log level, {all,debug,info,warning,error,fatal}, default: info",
    frmt: lower,
    dflt: "info"
  }, {
    name: "-e, --execute",
    desc: "execute without prompting"
  }, {
    name: "-a, --abort",
    desc: "abort when a request failed"
  }
];

args.forEach(function(arg) {
  cli.option(arg.name, arg.desc, arg.frmt || noFormat, arg.dflt);
});


module.exports = function(argv) {
  var packageContent = fs.readFileSync(path.join(process.env.base, "package.json"));
  var version = JSON.parse(packageContent).version;
  cli._name = "aws-setup";
  return cli.version(version).parse(argv);
};
