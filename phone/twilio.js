var db = require('../db'),
    models = require('../models'),
    settings = require('../settings');

var awaitSMS = function(type) {
  // Magic args
  var args = Array.prototype.slice.call(arguments);

  var callback = args.pop();
  var from = args[1] || undefined;

  // Try to find a free sms number
  var nums = [];
  for (var i in settings.phoneNumbers) if (settings.phoneNumbers.hasOwnProperty(i))
    nums.push(i);

  // Loops through available numbers
  var next = function() {

    // If we're out of numbers, bail
    if (!nums.length) return callback(new Error('No free numbers'));

    // Otherwise, see if the num is free
    var num = nums.pop();
    db.queryOne(models.AwaitedSMS, {to: num}, function(err, obj) {

      // If the DB threw an error, or the query returns an object (which
      // means the numbers IS in use), try the next number.
      if (err || obj) return next();

      // Otherwise, we've found a free number and can use it.
      var asms = new models.AwaitedSMS();
      if (from) asms.from = from;
      asms.type = type;
      asms.to = num;
      db.apply(asms, function(err) {

        // Errors are bad
        if (err) {
          console.log('Error while setting up sms await:');
          console.log(err.stack);
          console.log('');

          return callback(err);
        }

        // Give the callback the number we used.
        callback(undefined, num);
      });
    });

  };

  // Bootstrap it
  next();
};

exports.awaitSMS = awaitSMS;
