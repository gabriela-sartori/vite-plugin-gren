'use strict';

var spawn = require("cross-spawn");
var _ = require("lodash");
var grenBinaryName = "gren";
var fs = require("fs");
var path = require("path");
var temp = require("temp").track();
var findAllDependencies = require("./find-gren-dependencies").findAllDependencies;

var defaultOptions = {
  spawn: spawn,
  cwd: undefined,
  pathToGren: undefined,
  help: undefined,
  output: undefined,
  report: undefined,
  debug: undefined,
  verbose: false,
  processOpts: undefined,
  docs: undefined,
  optimize: undefined,
};

var supportedOptions = _.keys(defaultOptions);

function prepareSources(sources) {
  if (!(sources instanceof Array || typeof sources === "string")) {
    throw "compile() received neither an Array nor a String for its sources argument.";
  }

  return typeof sources === "string" ? [sources] : sources;
}

function prepareOptions(options, spawnFn) {
  return _.defaults({ spawn: spawnFn }, options, defaultOptions);
}

function prepareProcessArgs(sources, options) {
  var preparedSources = prepareSources(sources);
  var compilerArgs = compilerArgsFromOptions(options);

  return ["make"].concat(preparedSources ? preparedSources.concat(compilerArgs) : compilerArgs);
}

function prepareProcessOpts(options) {
  var env = _.merge({ LANG: 'en_US.UTF-8' }, process.env);
  return _.merge({ env: env, stdio: "inherit", cwd: options.cwd }, options.processOpts);

}

function runCompiler(sources, options, pathToGren) {
  if (typeof options.spawn !== "function") {
    throw "options.spawn was a(n) " + (typeof options.spawn) + " instead of a function.";
  }

  var processArgs = prepareProcessArgs(sources, options);
  var processOpts = prepareProcessOpts(options);

  if (options.verbose) {
    console.log(["Running", pathToGren].concat(processArgs).join(" "));
  }

  return options.spawn(pathToGren, processArgs, processOpts);
}

function compilerErrorToString(err, pathToGren) {
  if ((typeof err === "object") && (typeof err.code === "string")) {
    switch (err.code) {
      case "ENOENT":
        return "Could not find Gren compiler \"" + pathToGren + "\". Is it installed?";

      case "EACCES":
        return "Gren compiler \"" + pathToGren + "\" did not have permission to run. Do you need to give it executable permissions?";

      default:
        return "Error attempting to run Gren compiler \"" + pathToGren + "\":\n" + err;
    }
  } else if ((typeof err === "object") && (typeof err.message === "string")) {
    return JSON.stringify(err.message);
  } else {
    return "Exception thrown when attempting to run Gren compiler " + JSON.stringify(pathToGren);
  }
}

function compileSync(sources, options) {
  var optionsWithDefaults = prepareOptions(options, options.spawn || spawn.sync);
  var pathToGren = options.pathToGren || grenBinaryName;

  try {
    return runCompiler(sources, optionsWithDefaults, pathToGren);
  } catch (err) {
    throw compilerErrorToString(err, pathToGren);
  }
}

function compile(sources, options) {
  var optionsWithDefaults = prepareOptions(options, options.spawn || spawn);
  var pathToGren = options.pathToGren || grenBinaryName;


  try {
    return runCompiler(sources, optionsWithDefaults, pathToGren)
      .on('error', function (err) { throw (err); });
  } catch (err) {
    throw compilerErrorToString(err, pathToGren);
  }
}

function getSuffix(outputPath, defaultSuffix) {
  if (outputPath) {
    return path.extname(outputPath) || defaultSuffix;
  } else {
    return defaultSuffix;
  }
}

// write compiled Gren to a string output
// returns a Promise which will contain a Buffer of the text
// If you want html instead of js, use options object to set
// output to a html file instead
// creates a temp file and deletes it after reading
function compileToString(sources, options) {
  const suffix = getSuffix(options.output, '.js');

  return new Promise(function (resolve, reject) {
    temp.open({ suffix }, function (err, info) {
      if (err) {
        return reject(err);
      }

      options.output = info.path;
      options.processOpts = { stdio: 'pipe' }

      var compiler;

      try {
        compiler = compile(sources, options);
      } catch (compileError) {
        return reject(compileError);
      }

      compiler.stdout.setEncoding("utf8");
      compiler.stderr.setEncoding("utf8");

      var output = '';
      compiler.stdout.on('data', function (chunk) {
        output += chunk;
      });
      compiler.stderr.on('data', function (chunk) {
        output += chunk;
      });

      compiler.on("close", function (exitCode) {
        if (exitCode !== 0) {
          return reject(new Error('Compilation failed\n' + output));
        } else if (options.verbose) {
          console.log(output);
        }

        fs.readFile(info.path, { encoding: "utf8" }, function (err, data) {
          return err ? reject(err) : resolve(data);
        });
      });
    });
  });
}

function compileToStringSync(sources, options) {
  const suffix = getSuffix(options.output, '.js');

  const file = temp.openSync({ suffix });
  options.output = file.path;
  let compileProcess = compileSync(sources, options);

  if (compileProcess.status == 0) {
    return fs.readFileSync(file.path, { encoding: "utf8" });
  }
  else {
    // Throw a simple error. We already let gren output to stdout/stderr
    throw 'Compilation failed.';
  }
}

// Converts an object of key/value pairs to an array of arguments suitable
// to be passed to child_process.spawn for gren make.
function compilerArgsFromOptions(options) {
  return _.flatten(_.map(options, function (value, opt) {
    if (value) {
      switch (opt) {
        case "help": return ["--help"];
        case "output": return ["--output", value];
        case "report": return ["--report", value];
        case "debug": return ["--debug"];
        case "docs": return ["--docs", value];
        case "optimize": return ["--optimize"];
        case "runtimeOptions": return [].concat(["+RTS"], value, ["-RTS"]);
        default:
          if (supportedOptions.indexOf(opt) === -1) {
            if (opt === "yes") {
              throw new Error('node-gren-compiler received the `yes` option, but that was removed in Gren 0.19. Try re-running without passing the `yes` option.');
            } else if (opt === "warn") {
              throw new Error('node-gren-compiler received the `warn` option, but that was removed in Gren 0.19. Try re-running without passing the `warn` option.');
            } else if (opt === "pathToMake") {
              throw new Error('node-gren-compiler received the `pathToMake` option, but that was renamed to `pathToGren` in Gren 0.19. Try re-running after renaming the parameter to `pathToGren`.');
            } else {
              throw new Error('node-gren-compiler was given an unrecognized Gren compiler option: ' + opt);
            }
          }

          return [];
      }
    } else {
      return [];
    }
  }));
}

module.exports = {
//   compile: compile,
//   compileSync: compileSync,
//   compileWorker: require("./worker")(compile),
  compileToString: compileToString,
//   compileToStringSync: compileToStringSync,
  findAllDependencies: findAllDependencies,
//   _prepareProcessArgs: prepareProcessArgs
};