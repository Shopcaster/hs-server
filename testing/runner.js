var colors = require('colors'),
    fs = require('fs');

// Failure
var Fail = function(name, details) {
  this.name = name;
  this.details = details;
};
Fail.prototype.print = function(indent) {
  console.log(indent + this.name.white + ': ' + 'Fail'.red);

  if (typeof this.details == 'object' && this.details.stack) {

    var stack = this.details.stack.split('\n');
    for (var i=0; i<stack.length; i++)
      stack[i] = indent + '  ' + stack[i];
    console.log(stack.join('\n').white);

  } else if (this.details) {

    var details = this.details.toString().split('\n');
    for (var i=0; i<details.length; i++)
      details[i] = indent + '  ' + details[i];
    console.log(details.join('\n').white);

  }
};

// Success
var Pass = function(name) { this.name = name };
Pass.prototype.print = function(indent) {
  console.log(indent + this.name.white + ': ' + 'Pass'.green);
};

// What?
var Unknown = function(name, val) {
  this.val = val;
  this.name = name;
};
Unknown.prototype.print = function(indent) {
  console.log(indent + this.name.white + ': ' + 'Unknown '.yellow + this.val);
};

var Deferred = function(timeout, callback) {
  this.done = callback;

  var self = this;
  if (timeout) {
    setTimeout(function() {
      self.done(new Error('Timed out'));
      self.done = function() {};
    }, timeout);
  }
};

var Runner = function(name, callback) {
  this.name = name;
  this.tests = [];
  this._defers = 0;
  this._done = callback;

  var self = this;
  this._dclbk = function() {
    self._defers--;
  };
};
Runner.prototype.run = function(r) {
  r(this);

  //on the next tick, check for done
  var self = this;
  process.nextTick(function() {
    //if there are no defers, fire the done callback
    if (self._defers === 0) self._done();
    //otherwise update the defer callback to handle that
    else self._dclbk = function() {
      if (--self._defers === 0) self._done();
    };
  });

};
Runner.prototype.test = function(name, x) {
  var self = this;

  if (typeof x == 'function') {
    this._defers++;
    var self = this;
    var r = new Runner(name, function() { self._dclbk() });
    this.tests.push(r);
    r.run(x);
  } else if (typeof x == 'boolean') {
    if (x) this.tests.push(new Pass(name));
    else this.tests.push(new Fail(name));
  } else {
    this.tests.push(new Unknown(name, x));
  }
};
Runner.prototype.defer = function(name, timeout) {
  this._defers++;

  var self = this;
  return new Deferred(timeout, function(r) {
    self.tests.push(r && !(r instanceof Error) ? new Pass(name) : new Fail(name));
    self._dclbk();
  });
};
Runner.prototype.print = function(indent) {
  indent = indent || '';

  console.log(indent + this.name.blue);

  for (var i=0; i<this.tests.length; i++)
    this.tests[i].print(indent + '  ');
};

// TODO - load this by scanning the directory
var testModules = [
  './util.js'
];

var run = function(callback) {
  var running = 0;
  var results = [];

  var finish = function() {
    var r = new Runner('');
    r.tests = results;
    callback(r);
  };

  var decRunning = function() {
    if (--running === 0) finish();
  }

  for (var i=0; i<testModules.length; i++) {
    //import
    try {
      var m = require(testModules[i]);
    } catch (err) {
      results.push(new Fail(m.desc, err));
      continue;
    }

    //make sure it's testable
    if (!m.run) {
      results.push(new Fail(m.desc, 'Not a testable module'));
      continue;
    }

    //do the test
    var runner = new Runner(m.desc, decRunning);
    running++;
    results.push(runner);
    runner.run(m.run);
  }

  //if nothing is running just hit the callback now
  if (running === 0) finish();
};

exports.run = run;
