var fs = require('fs');

// Template cache -- we preload them here for optimization and to
// avoid having to jump through callbacks.
var templates = {};

// The grand template regex.  Basically, this allows for templates of
// the form:
//
//     This is a bunch of text and {{ foobar }} is a
//     variable insertion!
//
var tre = /{{\s*([\w\-_]+)\s*}}/

var Template = function(f) {
  // Load the template
  var contents = fs.readFileSync('templates/' + f, 'utf8') // yeah yeah... this is why we precache

  // Make sure the file actually read correctly
  if (!contents && contents !== '')
    throw new Error('Failed reading template ' + f);

  // Parse the template
  this.parts = contents.split(tre);
};
Template.prototype = {};
Template.prototype.render = function(data) {
  // Shortcut -- if there's only one part, there are no variables
  // used and we can just return it.
  if (this.parts.length == 1)
    return this.parts[0];

  // We append rendered parts to this
  var rendered = '';

  // The parts list alternates between "raw" and "variable," even in
  // the case of back-to-back variables (the raw part in between being
  // simply an empty string.)
  var raw = true;
  for (var i=0; i<this.parts.length; i++) {
    var part = this.parts[i];

    if (raw)
      rendered += part;
    else if (data[part] !== null && data[part] !== undefined)
      rendered += data[part];

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

exports.init = init;

