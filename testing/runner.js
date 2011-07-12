//todo - handle exceptions

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
    console.log(stack.join('\n').white + '\n');

  } else if (this.details) {

    var details = this.details.toString().split('\n');
    for (var i=0; i<details.length; i++)
      details[i] = indent + '  ' + details[i];
    console.log(details.join('\n').white + '\n');

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
  console.log(indent + this.name.white + ': ' + 'Unknown'.yellow.inverse +
    ' ' + (this.val + '').yellow);
};

var Deferred = function(timeout, callback) {
  this._callback = callback;

  //default timeout
  if (typeof timeout != 'number') timeout = 2000; //2sec default timeout

  var self = this;
  if (timeout) {
    this._to = setTimeout(function() {
      self.done(new Error('Timed out'));
      self.done = function() {};
    }, timeout);
  }
};
Deferred.prototype = {};
Deferred.prototype.done = function(success) {
  if (this._to) clearTimeout(this._to);
  this.done = function() {};
  this._callback(success);
};

var Runner = function(name, callback) {
  this.name = name;
  this.tests = [];
  this._defers = 0;
  this._callback = callback;
  this._conts = [];

  var self = this;
  this._dclbk = function() {
    self._defers--;
  };
};
Runner.prototype._done = function() {
  // If we have continuations to run, save the needed state
  // and then re-initialize and rerun the test using the conts.
  if (this._conts.length) {
    var conts = this._conts;
    var tests = this.tests;
    var callback = this._callback;
    var name = this.name;

    // Reinit the object
    Runner.call(this);
    // Fix the state
    this.tests = tests;
    this._callback = callback;
    this.name = name;

    // Run each continuation
    var self = this;
    self.run(function() {
      for (var i=0; i<conts.length; i++)
        self.test.apply(self, conts[i]);
    });

  // Otherwise, just fire the callback to signal that we're done
  } else {
    this._callback();
  }
};
Runner.prototype.run = function(f) {
  var e;

  try {
    f(this);
  } catch (err) {
    // rethrow error later
    e = err;
  }

  //on the next tick, check for done
  var self = this;
  process.nextTick(function() {
    //if there are no defers, fire the done callback
    if (self._defers === 0) self._done();
    //otherwise update the defer callback to handle that
    else self._dclbk = function() {
      if (--self._defers === 0) {
        //don't call success immediately, in case the same tick adds
        //more defers
        process.nextTick(function() {
          if (self._defers === 0) self._done();
        });
      }
    };
  });

  if (e) throw e;
};
Runner.prototype.test = function(name, x) {
  var self = this;

  if (typeof x == 'function') {
    this._defers++;
    var self = this;
    var r = new Runner(name, function() { self._dclbk(); });
    this.tests.push(r);
    r.run(x);

    return {
      test: function() {
        var args = Array.prototype.slice.call(arguments);
        self._conts.push(args);
      }
    };

  } else if (typeof x == 'boolean') {
    this.tests.push(x ? new Pass(name) : new Fail(name));
  } else if (typeof x == 'undefined') {
    this.tests.push(new Unknown(name));
  } else {
    this.tests.push(!!x ? new Pass(name) : new Fail(name));
  }

  return this;
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
  './util',
  './interface/test'
];

var run = function(callback) {
  var errors = [];
  var running = 0;
  var results = [];

  //record uncaught exceptions
  process.on('uncaughtException', function(err) {
    errors.push(new Fail('Exception ' + errors.length + 1, err));
  });

  var finish = function() {
    //return the root runner
    var r = new Runner('');
    r.tests = errors.concat(results);
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
      results.push(new Fail(m.desc + '\n', err));
      continue;
    }

    //make sure it's testable
    if (!m.run) {
      results.push(new Fail('\n  ' + m.desc || testModules[i], 'Not a testable module'));
      continue;
    } else if (!m.desc) {
      results.push(new Fail('\n  ' + testModules[i], 'Missing desc'));
      continue;
    }

    //do the test
    var runner = new Runner('\n' + m.desc, decRunning);
    running++;
    results.push(runner);
    runner.run(m.run);
  }

  //if nothing is running just hit the callback now
  if (running === 0) finish();
};

exports.run = run;
