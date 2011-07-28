//
// Common node-facing API interface logic
//

var fs = require('fs'),
    url = require('url'),
    settings = require('../settings'),
    filePath = __dirname + '/api.js';

var setVar = function(code, vr, val) {
  // Generate the substitution regex
  var re = new RegExp('/\\*\\$' + vr + '\\$\\*\\/', 'im');

  // If val is a string, it needs to be formatted and escaped
  if (typeof val == 'string')
    val = "'" + val.replace("'", "\\'") + "'";

  return code.replace(re, val);
};

// Synchronously reads the file from the disk.
var cached;
var getCode = function() {
  // If we've cached the file in memory, return it.
  if (cached) return cached;

  // Initialize the code
  var code = '';

  // Get the deps
  code += fs.readFileSync(__dirname + '/deps.js');
  // Add the croquet library
  code += fs.readFileSync(__dirname + '/../croquet/croquet.client.js');
  // Fetch the library
  code += fs.readFileSync(filePath, 'utf8');

  // Set the settings
  with({u: url.parse(settings.serverUri)}) {
    code = setVar(code, 'port', u.port);
    code = setVar(code, 'host', u.hostname);
    code = setVar(code, 'secure', false);
  }

  // If we have uglify, and compression is enabled, do it.
  if (settings.compressApiLibrary) {
    try {
      var uglify = require('uglify-js');
      var ast = uglify.parser.parse(code);
      // Compress it
      ast = uglify.uglify.ast_mangle(ast);
      //ast = uglify.uglify.ast_squeeze(ast, {dead_code: false});
      // Regenerate the Javascript
      code = uglify.uglify.gen_code(ast);

    // If an error occurred, then just abort any attempts to compress
    } catch (err) {
      console.log(err.stack);
    }
  }

  // Cache the results so we don't go through this whole
  // process every time.
  cached = code;

  return code;
};

// Watch the api file for changes
fs.watchFile(filePath, function(cur, prev) {
  // If it's changed
  if (cur.mtime > prev.mtime) {
    console.log('API library file has changed, marking for reload');
    console.log('');
    cached = null;
  }
});
// Watch croquet for changes
fs.watchFile(__dirname + '/../croquet/croquet.client.js', function(cur, prev) {
  // If it's changed
  if (cur.mtime > prev.mtime) {
    console.log('Croquet client file has changed, marking for reload');
    console.log('');
    cached = null;
  };
});

exports.getCode = getCode;
