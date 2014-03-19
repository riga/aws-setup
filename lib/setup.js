// load node modules
var fs   = require("fs"),
    path = require("path");

// load npm modules
var extend = require("node.extend"),
    AWS    = require("aws-sdk"),
    async  = require("async"),
    Class  = require("node-oo"),
    yaml   = require("js-yaml");

// load local modules
var cli        = require("lib/cli.js"),
    logger     = require("lib/logger.js"),
    actions    = require("lib/actions.js"),
    formatters = require("lib/formatters.js");


// register a compiler for yaml files
var yamlCompiler = function(module, path) {
  try {
    module.exports = yaml.safeLoad(fs.readFileSync(path, "utf8"));
  } catch (err) {
    throw err;
  }
};
require.extensions[".yml"] = yamlCompiler;
require.extensions[".yaml"] = yamlCompiler;


var Setup = Class._extend({

  init: function(args) {
    this.args = args;

    this.logger = logger(args.logLevel);

    this.setupsDir      = null;
    this.mappingFile    = null;
    this.stepMapping    = null;
    this.formattersFile = null;
    this.formatters     = null;
    this.actions        = null;
    this.setupFile      = null;
    this.extension      = null;
    this.content        = null;

    this.loadAWS();
    this.loadSetupsDir();
    this.loadMappings();
    this.loadFormatters();
    this.loadSetupContent();
  },

  abort: function() {
    this.logger.fatal.apply(this.logger, arguments);
    process.exit(1);
  },

  loadAWS: function() {
    // accessKeyId, secretAccessKey and securityToken are taken from env
    // load region from AWS_DEFAULT_REGION
    AWS.config.region = process.env["AWS_DEFAULT_REGION"];

    // extend by config file if present
    if (fs.existsSync(this.args.configFile)) {
      var cf = path.resolve(this.args.configFile);

      AWS.config.loadFromPath(cf);
      this.logger.debug("load AWS config from '%s'", cf);
    } else
      this.logger.debug("no AWS config file found");

    return this;
  },

  loadSetupsDir: function() {
    this.setupsDir = path.resolve(this.args.setupsDir);
    return this;
  },

  loadMappings: function() {
    // the default mapping
    this.stepMapping = JSON.parse(fs.readFileSync(path.join(process.env.base, "stepmap.json")));

    if (fs.existsSync(this.args.stepMap))
      this.mappingFile = this.args.stepMap;
    else if (this.setupsDir && fs.existsSync(path.join(this.setupsDir, this.args.stepMap)))
      this.mappingFile = path.join(this.setupsDir, this.args.stepMap);
    else {
      this.logger.debug("no additional stepmap found");
      return this;
    }

    this.mappingFile = path.resolve(this.mappingFile);

    // extend our mapping
    try {
      var mapping = JSON.parse(fs.readFileSync(this.mappingFile));
      extend(true, this.stepMapping, mapping);
    } catch (err) {
      this.logger.warning("cannot parse the stepmap at '%s'", this.mappingFile);
    }

    return this;
  },

  loadFormatters: function() {
    // the default formatters
    this.formatters = extend(true, {}, formatters);

    if (fs.existsSync(this.args.formatters))
      this.formattersFile = this.args.formatters;
    else if (this.setupsDir && fs.existsSync(path.join(this.setupsDir, this.args.formatters)))
      this.formattersFile = path.join(this.setupsDir, this.args.formatters);
    else {
      this.logger.debug("no additional formatters found");
      return this;
    }

    this.formattersFile = path.resolve(this.formattersFile);

    // extend our formatters
    extend(true, this.formatters, require(this.formattersFile));

    return this;
  },

  loadSetupContent: function() {
    var find = function(file) {
      if (fs.existsSync(file))
        return file;
      else if (fs.existsSync(file + ".json"))
        return file + ".json";
      else if (fs.existsSync(file + ".yml"))
        return file + ".yml";
      else if (fs.existsSync(file + ".js"))
        return file + ".js";
      else
        return null;
    };

    this.setupFile = find(this.args.setupFile);

    if (this.setupFile == null) {
      // the file does not exist, prepend the setups dir and try again
      if (!this.setupsDir || !fs.existsSync(this.setupsDir))
        this.abort("setups-dir '%s' does not exist", this.setupsDir);

      this.setupFile = find(path.join(this.setupsDir, this.args.setupFile));

      if (this.setupFile == null)
        this.abort("setup-file does not exist");
    } else
      this.setupFile = path.resolve(this.setupFile);

    this.logger.debug("use setup-file at '%s'", this.setupFile);

    // determine the file extension to read the setup content
    this.extension = this.setupFile.split(".").pop();
    if (!this.extension || !~["json", "yml", "js"].indexOf(this.extension.toLowerCase()))
      this.abort("setup-file extension '%s' not supported", this.extension);
    this.extension = this.extension.toLowerCase();
    this.logger.debug("setup-file extension is '%s'", this.extension);

    // read the content
    this.content = require(this.setupFile);
    if (this.content instanceof Function)
      this.content = this.content(this.args.payload);
    this.logger.debug("read setup content");

    return this;
  },

  run: function() {
    var self = this;

    // the list of calls that will be processed
    var calls = [];

    var payload = [];

    // determine the groups to process
    var groups = this.args.group;
    if (!groups || !groups.length) {
      this.logger.debug("no group set, use all groups");
      groups = Object.keys(this.content);
    }
    this.logger.debug("%s group%s found", groups.length, groups.length == 1 ? "" : "s");

    // determine the steps per group
    var steps = this.args.steps;
    if (steps) {
      if (steps.length != groups.length)
        this.abort("steps and groups cannot be matched");
    } else {
      steps = [];
      groups.forEach(function(group) {
        steps.push(self.content[group].steps || Object.keys(self.content[group]));
      });
    }
    var l = 0;
    steps.forEach(function(_steps) { l += _steps.length; });
    this.logger.debug("%s step%s found", l, l == 1 ? "" : "s");

    // the delay function
    var t = isNaN(this.args.timeout) ? 0 : this.args.timeout;
    var delay = function(callback) {
      setTimeout(callback.bind(null, null), t * 1000);
    };

    // create the calls
    groups.forEach(function(group, i) {
      // omit groups with leading underscores
      if (group[0] == "_")
        return;

      var groupSteps = steps[i];
      groupSteps.forEach(function(step) {
        var action = actions(self.stepMapping, step);
        var configName = self.stepMapping[step].config;
        var config = self.content[group][configName];
        if (!isArray(config))
          config = [config];
        config.forEach(function(_config) {
          _config = self.parseConfig(_config);
          self.logger.debug("parsed config for '%s.%s' (%s): \n%s", group, step, configName,
            JSON.stringify(_config, null, 2));
          calls.push(function(callback) {
            var onSuccess = function() {
              self.logger.info("successfully processed '%s.%s'", group, step);
            };
            var onError = function(err) {
              self.logger.error("%s (%s, %s)", err.message, err.statusCode, err.name);
              if (self.args.abort)
                self.abort("abort");
            };
            action(_config, onSuccess, onError, callback);
          });
          calls.push(delay);
          self.logger.info("queue step '%s.%s'", group, step);
        });
      });

    });

    // the last call is a delay, remove it
    calls.pop();

    // finally, execute
    var execute = function() {
      self.logger.info("executing ...");
      async.series(calls, function(err) {
        if (err)
          throw err;
        self.logger.info("done");
        process.exit(0);
      });
    };

    if (this.args.execute || !calls.length)
      execute();
    else {
      console.log("\nProcess queue (%s)? (y/n)", parseInt((calls.length + 1) * 0.5));
      process.stdin.on("data", function(chunk) {
        if (String(chunk) == "y\n")
          execute();
        else
          process.exit(0);
      });
    }

    return this;
  },

  parseConfig: function(data) {
    var self = this;

    if (isObject(data)) {
      Object.keys(data).forEach(function(key) {
        data[key] = self.parseConfig(data[key]);
      });
      return data;
    }
    if (isArray(data))
      return data.map(this.parseConfig.bind(this));
    if (isNumber(data))
      return data;
    if (isBoolean(data))
      return data;
    if (isNull(data))
      return data;

    // string => try to parse simple syntax
    var varStart = "${", varEnd = "}";
    var fmtStart = "%{", fmtEnd = "}";

    var varRe = /^([^\|]+)(|\|(.*))$/;
    var fmtRe = /([^\:]+)(\:(.*))?/;

    var replaceSyntax = function(s) {
      var varMax = fmtMax = Number.MAX_VALUE;

      while (true) {
        var lastVarIdx = s.substr(0, varMax).lastIndexOf(varStart);
        var lastFmtIdx = s.substr(0, fmtMax).lastIndexOf(fmtStart);

        if (~lastVarIdx && lastVarIdx > lastFmtIdx) {
          // replace a variable
          varMax = lastVarIdx;

          var start = lastVarIdx + varStart.length;
          var end = s.indexOf(varEnd, lastVarIdx);
          var len = end - (lastVarIdx + varStart.length);
          if (!~end)
            continue;

          var substr = s.substr(start, len);
          var m = substr.match(varRe);

          if (!m)
            continue;
          else {
            var varName = m[1];
            var _default = !!m[2] ? m[3] : "";
            var value = self.args.payload[varName] != null ? self.args.payload[varName] : _default;
            s = s.substr(0, lastVarIdx) + value + s.substr(end + varEnd.length);
          }
        } else if (~lastFmtIdx && lastFmtIdx > lastVarIdx) {
          // replace a format
          fmtMax = lastFmtIdx;

          var start = lastFmtIdx + fmtStart.length;
          var end = s.indexOf(fmtEnd, lastFmtIdx);
          var len = end - (lastFmtIdx + fmtStart.length);
          if (!~end)
            continue;

          var substr = s.substr(start, len);
          var m = substr.match(fmtRe);

          if (!m)
            continue;
          else {
            var args;
            if (m[2] == undefined || m[2] == ":")
              args = [];
            else
              args = m[3].split(",").map(function(arg) {
                return arg.trim();
              });
            var fmt = self.formatters;
            m[1].split(".").forEach(function(part) {
              if (fmt[part] == null)
                self.abort("formatter '%s' not found", m[1]);
              fmt = fmt[part];
            });
            var value = fmt.apply(null, args);
            s = s.substr(0, lastFmtIdx) + value + s.substr(end + fmtEnd.length);
          }
        } else
          break;
      }
      return s;
    };

    return replaceSyntax(data);
  }
});


// type helper functions
var isObject = function(obj) {
  return Object.prototype.toString.call(obj) == "[object Object]";
};
var isArray = function(arr) {
  return arr instanceof Array;
};
var isNumber = function(num) {
  return typeof(num) == "number";
};
var isBoolean = function(b) {
  return typeof(b) == "boolean";
};
var isFunction = function(f) {
  return f instanceof Function;
};
var isNull = function(v) {
  return v == null;
};


// parse args and start the setup
var setup = new Setup(cli(process.argv));
setup.run();
