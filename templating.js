var fs = require('fs'),
    vm = require('vm'),
    settings = require('./settings');

// Template cache -- we preload them here for optimization and to
// avoid having to jump through callbacks.
var templates = {};

// The grand template regex.  Basically, this allows for templates of
// the form:
//
//     This is a bunch of text and {{ [javascript expression] }} is a
//     variable insertion!
//
var tre = /{{[\s\r\n]*([\s\S]+?)[\s\r\n]*}}/;

var Template = function(f) {
  // Load the template
  var contents = fs.readFileSync('templates/' + f, 'utf8') // yeah yeah... this is why we precache

  // Make sure the file actually read correctly
  if (!contents && contents !== '')
    throw new Error('Failed reading template ' + f);

  // Parse the template
  this.parts = contents.split(tre);

  // Precompile the snippets
  for (var i=1; i<this.parts.length; i+=2) {
    try {
      var code = this.parts[i];
      this.parts[i] = vm.createScript(this.parts[i]);
      this.parts[i].code = code;
    } catch (err) {
      console.log('Error compiling template ' + f + ':' + err.message);
      console.log('  From snippet: ');
      var split = this.parts[i].split('\n');
      for (var j=0; j<split.length; j++)
        console.log('    ' + split[j]);

      // This is a catastrophic error
      process.exit(0);
    }
  }

  // Record the file this is from for future reference
  this.file = f;
  // Also the directory
  var split = f.split('/');
  split.pop();
  this.dir = split.join('/');

};
Template.prototype = {};
Template.prototype.render = function(data) {
  var self = this;

  // Shortcut -- if there's only one part, there are no variables
  // used and we can just return it.
  if (this.parts.length == 1)
    return this.parts[0];

  // Clone the data and add some globals to it
  var newData = {};
  for (var i in data) if (data.hasOwnProperty(i))
    newData[i] = data[i];
  newData.settings = settings;
  newData.include = function(f, context) {
    var split = f.split('/');
    var built = self.dir.split('/');

    while (split.length) {
      var p = split.shift();

      // Going up a directory pops
      if (p == '..' && built.length) built.pop();
      // The same dir is a nop
      else if (p == '.') continue;
      // Everything else is appended
      else built.push(p);
    }

    t = exports[built.join('/')];
    return t.render(context);
  };

  // We append rendered parts to this
  var rendered = '';

  // The parts list alternates between "raw" and "variable," even in
  // the case of back-to-back variables (the raw part in between being
  // simply an empty string.)
  var raw = true;
  for (var i=0; i<this.parts.length; i++) {
    var part = this.parts[i];

    if (raw) {
      rendered += part;
    } else {
      try {
        var val = part.runInNewContext(newData);

        // Only show this variable if it has a value
        if (val !== null && val !== undefined) rendered += val;

      } catch (err) {
        console.log('Error in template ' + this.file + ': ', err.message);
        console.log('  In this snippet');
        var split = part.code.split('\n');
        for (var j=0; j<split.length; j++)
          console.log('    ' + split[j]);
        console.log('')
      }
    }

    // Flip raw for the alternation
    raw = !raw;
  }

  // And now we return the rendered form
  return rendered;
};

// Initializes the templating system by caching all templates in the
// template directory.
var init = function() {
  // Recursively reads templates in the template directory
  var walk = function(base) {
    var bdir = base ? base + '/' : '';
    var lbase = 'templates' + (base ? '/' + base : '');

    // Fetch 'em
    var files = fs.readdirSync(lbase);

    // Walk 'em
    for (var i=0; i<files.length; i++) {
      // Disallow anything named `init` so it doesn't conflict
      if (files[i] == 'init')
        throw new Error('Templates or template folders named "init" are not allowed');

      // Get file stats
      var stat = fs.statSync(lbase + '/' + files[i]);

      // If it's a file, load the template and cache it
      if (stat.isFile())
        exports[bdir + files[i].split('.')[0]] = new Template(bdir + files[i]);

      // If it's a directory, recurse it
      else if (stat.isDirectory())
        arguments.callee(bdir + files[i]);
    }
  };

  // Walk the root template directory.  The 'template/' prefix is
  // assumed, so we don't specify it here.
  walk('');
};

// This just serves up templates so that we can test the results
var serve = function(req, res) {
  var url = req.url.match(/^\/template\/(.*)/)[1];

  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(exports[url].render());
};

exports.init = init;
exports.serve = serve;

