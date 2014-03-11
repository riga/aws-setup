// load node modules
var fs   = require("fs"),
    path = require("path");

// load npm modules
var extend = require("node.extend"),
    AWS    = require("aws-sdk"),
    async  = require("async"),
    Class  = require("node-oo");

// load local modules
var cli        = require("lib/cli.js"),
    logger     = require("lib/logger.js"),
    actions    = require("lib/actions.js"),
    formatters = require("lib/formatters.js");


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

    this.loadConfig();
    this.loadSetupsDir();
    this.loadMappings();
    this.loadFormatters();
    this.loadSetupContent();
  },

  abort: function() {
    this.logger.fatal.apply(this.logger, arguments);
    process.exit(1);
  },

  loadConfig: function() {
    if (!fs.existsSync(this.args.configFile))
      this.abort("no AWS config found");

    var cf = path.resolve(this.args.configFile);

    AWS.config.loadFromPath(cf);
    this.logger.debug("load AWS config from '%s'", cf);

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
    if (!this.extension || !~["json", "js"].indexOf(this.extension.toLowerCase()))
      this.abort("setup-file extension '%s' not supported", this.extension);
    this.extension = this.extension.toLowerCase();
    this.logger.debug("setup-file extension is '%s'", this.extension);

    // read the content
    if (this.extension == "json")
      this.content = JSON.parse(fs.readFileSync(this.setupFile));
    else
      this.content = require(this.setupFile);
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
          calls.push(function(callback) {
            var onSuccess = function() {
              self.logger.info("succeeded '%s.%s'", group, step);
            };
            var onError = function(err) {
              self.logger.error("%s (%s, %s)", err.message, err.statusCode, err.name);
              if (self.args.abort)
                self.abort("abort");
            };
            action(_config, onSuccess, onError, callback);
          });
          self.logger.info("queue step '%s.%s'", group, step);
        });
      });

    });

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

    if (this.args.execute)
      execute();
    else {
      console.log("\nProcess queue? (y/n)");
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
    if (isObject(data)) {
      Object.keys(data).forEach(function(key) {
        data[key] = this.parseConfig(data[key]);
      }, this);
      return data;
    }
    if (isArray(data))
      return data.map(this.parseConfig.bind(this));
    if (isNumber(data))
      return data;
    if (isBoolean(data))
      return data;

    // string => try to parse simple syntax


    // replace with payload
    var reVar = /.*(\$\{([^\|]+)(\|(.*))?\}).*/;
    var mVar = data.match(reVar);

    if (mVar && mVar.length == 5) {
      var val = this.args.payload[mVar[2]];
      if (val == null)
        val = mVar[4];
      if (val != null)
        data = data.replace(mVar[1], val);
      try {
        data = JSON.parse(data);
      } catch (err) {}
    }

    // apply formatters
    var reFmt = /.*(\$\(([^\:]+)(|\:|\:(.+))\)).*/;
    var mFmt = data.match(reFmt);

    if (mFmt && mFmt.length == 5) {
      var fmt = this.formatters;
      mFmt[2].split(".").forEach(function(part) {
        if (!fmt[part])
          this.abort("formatter '%s' not found", mFmt[2]);
        fmt = fmt[part];
      }, this);
      if (isFunction(fmt)) {
        var arg = mFmt[3];
        if (arg[0] == ":")
          arg = arg.substr(1);
        var args = arg ? arg.split(",") : [];
        args.map(function(arg) {
          return arg.trim();
        });
        var val = fmt.apply(null, args);
        if (val != null)
          data = data.replace(mFmt[1], val);
      }
    }


    return data;
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


// parse args and start the setup
var setup = new Setup(cli(process.argv));
setup.run();
