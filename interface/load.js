//
// API Loader
//
// The API interface (`api.js`) isn't a CommonJS module, but this module
// is.  It loads the interface and converts it into a real CommonJS
// module so that it can be loaded.
//
// This module has a single dependency: websocket-client
// It also expects a settings module to be present in the parent.  This
// module should contain a string uri, set to the server uri.
//
// Optionally, if UglifyJS is installed, the loader will make use of
// it to give detailed syntax errors should `api.js` contain any.
//

var vm = require('vm'),
    fs = require('fs'),
    crypto = require('crypto'),
    url = require('url'),
    settings = require('../settings');

// The interface expects a certain environment; this sets it up.
var context = {};
// Add sha256
context.sha256 = function(input) {
  var sha = crypto.createHash('sha256');
  sha.update(input);
  return sha.digest('hex');
};
// Add socket IO
context.io = require('./_node-socketio-client').io;
// JSON support is baked in, so we don't need to add it
// Add console
context.console = console;
// Add the conf object
with ({u: url.parse(settings.serverUri)}) {
  context.conf = {};
  context.conf.zz = {};
  context.conf.zz.server = {};
  context.conf.zz.server.host = u.hostname;
  context.conf.zz.server.port = u.port;
}
// Add localStorage as an object
context.localStorage = {};
// setTimeout doesn't exist by default : /
context.setTimeout = setTimeout;
context.clearTimeout = clearTimeout;

// Cache the current keys in the context so we know what to not export
// later.
var keys = {}; // Hash table for speed
for (var i in context) if (context.hasOwnProperty(i))
  keys[i] = true;

// Load the code!  Note the synchrony; async will break CommonJS import
// workings, since it's inline itself.
var code = fs.readFileSync(__dirname + '/api.js', 'utf8');

// Parse it using uglify, if it's available
try {
  var jsp = require('uglify-js').parser;
} catch (err) {}
if (jsp) {
  try {
    jsp.parse(code);
  } catch (err) {
    throw 'Syntax error in api.js (' + err.line + ':' + err.col +
      ') \n  ' + err.message;
  }
}

// Compile it
code = vm.createScript(code, 'api.js');

// Execute the code in its carefully constructed context
code.runInNewContext(context);

// Export everything but the baked-in context
for (var i in context) if (context.hasOwnProperty(i))
  if (!keys[i])
    exports[i] = context[i];

// Victory!
