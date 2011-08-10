var fs = require('fs'),
    vm = require('vm');

var Query = function(f) {
  this.filename = f;

  try {
    var contents = fs.readFileSync('queries/' + f, 'utf8');
    this.query = vm.createScript('(function() { return ' + contents + ' })();');
    exports[f] = this;
  } catch (err) {
    console.log('Error reading query ' + f + ':');
    var split = err.stack.split('\n');
    for (var i=0; i<split.length; i++)
      console.log('  ' + split[i]);

    // We isn't a super serious issue, but we really shouldn't
    // be running when the issue is really just malformed JSON.
    process.exit(0);
  }
};
Query.prototype = {};
Query.prototype.constructor = Query;
Query.prototype.make = function(params) {
  // Execute the script in the context of the params.  We have to
  // copy the data over for some strange reason, otherwise the data
  // isn't marked as an object.
  var q =this.query.runInNewContext(params);

  var obj = {};
  for (var i in q) if (q.hasOwnProperty(i))
    obj[i] = q[i];

  return obj;
};

// Initializes the querying system by synchronously scanning the queries
// folder and loading the JSON as objects.
var init = function() {

  // Recursively reads queries in the query directory
  var walk = function(base) {
    var bdir = base ? base + '/' : '';
    var lbase = 'queries' + (base ? '/' + base : '');

    // Fetch 'em
    var files = fs.readdirSync(lbase);

    // Walk 'em
    for (var i=0; i<files.length; i++) {
      // Disallow anything named `init` so it doesn't conflict.
      if (files[i] == 'init')
        throw new Error('Queries or query folders named "init" are not allowed');

      // Get file stats
      var stat = fs.statSync(lbase + '/' + files[i]);

      // If it's a file, load the query
      if (stat.isFile())
        exports[bdir + files[i].split('.')[0]] = new Query(bdir + files[i]);

      // If it's a directory, recurse it
      else if (stat.isDirectory())
        arguments.callee(bdir + files[i]);
    };
  };

  // Walk the root query directory.  The 'queries/' prefix is assumed,
  // so we don't specify it here.
  walk('');
};

exports.init = init;
