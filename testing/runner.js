var colors = require('colors');

// Failure
var Fail = function(details) { this.details = details };
Fail.prototype.print = function(var indent) {
  console.log(indent + 'Fail'.red);

  if (typeof this.details == object && this.details.stack)
    console.log(indent, this.details.stack);
  else if (this.details)
    console.log(indent, this.details);
};

// Success
var Pass = function() {};
Pass.prototype.print = function() {
  console.log(indent + 'Pass'.green);
};

// What?
var Unknown = function(val) {
  this.val = val;
};
Unknown.prototype.print = function() {
  console.log(indent + 'Unknown '.yellow + this.val);
};

var Deferred = function(root, callback) {
  this._root = root;
  this.done = callback;
};

var Runner = function(callback) {
  this.tests = [];
  this._defers = 0;
  this._done = callback;
};
Runner.prototype.test = function(name, x) {
  if (typeof x == 'function') {
    this._defers++;
    var r = new Runner(function() {
      if (--this._defers === 0) this._done();
    });
    this.tests.push([name, r]);
    x(r);
  } else if (typeof x == 'boolean') {
    if (x) this.tests.push([name, new Pass()]);
    else this.tests.push([name, new Fail()]);
  } else {
    this.tests.push([name, new Unknown(x));
  }
};
Runner.prototype.defer = function(name, timeout) {
  this._defers++;

  return new Deferred(this, timeout || 0, function(r) {
    this.tests.push([name, r ? new Pass() : new Fail()]);
    if (--this._defers === 0) this._done();
  });
};



var testModules = [
  './util.js'
];

var run = function() {
  var results = [];

  for (var i=0; i<testModules.length; i++) {
    //import
    try {
      var m = require(testModules[i]);
    } catch (err) {
      results.push([i, new Fail(err)]);
      continue;
    }

    //make sure it's testable
    if (!m.run) {
      results.push([i, new Fail('Not a testable module')]);
      continue;
    }

    //do the test
    var runner = new Runner();
    results.push([i, runner]);
    m.run(Runner());
  }

  // TODO - once all deferred tests are done, call the finished callback
};

exports.run = run;
exports.require = req;
