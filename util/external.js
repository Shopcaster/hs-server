var cp = require('child_process');

// Launches a child process, pumps in data, and calls the callback
// when the child exits.
var run = function(command, input, callback) {

  // Holds data returned from the child.  Yes, I'm pluralizing
  // something that's already plural.  Deal with it.
  var datas = [];
  // Holds errors returned from the child.
  var errors = [];

  // Spawn the child worker
  var child = cp.spawn('util/external/' + command);

  // Whenever the child sends data we shove it into our working list
  // of data buffers.
  child.stdout.on('data', function(data) {
    datas.push(data);
  });
  // We also want to log stderr so that we can give valuable feedback
  // if the child fails.
  child.stderr.on('data', function(data) {
    errors.push(data);
  });

  // Smooth error handling -- avoids broken pipe crashes
  child.stdout.on('error', function() {
    callback(true, new Buffer());
  });
  child.stderr.on('error', function() {
    callback(true, new Buffer());
  });

  // When the child exits, we send data back to the callback by merging
  // all the buffers into one.
  child.on('exit', function(code) {

    // Find out if we had success or not.  If the child process
    // terminated abnormally `code` is null; similarly, anything but
    //a 0 response code is treated as an error.
    var failed = code === null ? true : code === 0 ? false : true;

    // Select which data we're going to send to the user
    var theData = failed ? errors : datas;

    // Merged data
    var data;
    // Index into merged data
    var size = 0;

    // Count total data size
    for (var i=0; i<theData.length; i++)
      size += theData[i].length;

    // Allocate the aggregate data buffer
    data = new Buffer(size);

    // Copy the data into the aggregate buffer
    var count = 0;
    for (var i=0; i<theData.length; i++) {
      theData[i].copy(data, count, 0);
      count += theData[i].length;
    }

    // Fire the callback
    callback(failed, data);
  });

  // Feed the child data
  if (input) {
    child.stdin.write(input);
    child.stdin.end();
  }

};

exports.run = run;
