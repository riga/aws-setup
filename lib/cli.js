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
    name: "-f, --setup-file [FILE]",
    desc: "The setup file, relative to <setups-dir> (no file extension -> json > js), \
default: setup.(json|js)",
    dflt: "setup"
  }, {
    name: "-m, --step-map [FILE]",
    desc: "A additional step mapping json file, relative to <setups-dir>, default: stepmap.json",
    dflt: "stepmap.json"
  }, {
    name: "-g, --group [NAME[,...]]",
    desc: "The group to setup, accepts a list, default: all groups",
    frmt: list
  }, {
    name: "-s, --steps [NAME[,...]]",
    desc: "The steps to execute, accepts a list (,) or a list of lists (:), default: all steps",
    frmt: multiList
  }, {
    name: "-l, --log-level [LEVEL]",
    desc: "The log level, {all,debug,info,warning,error,fatal}, default: info",
    frmt: lower,
    dflt: "info"
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
