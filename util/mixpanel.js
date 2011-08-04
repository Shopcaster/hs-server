var http = require('http'),
    querystring = require('querystring');

var trackEmail = function(email, callback) {
  var data = querystring.stringify({
    body: email,
    // TODO - options
  });
  var options = {
    host: 'api.mixpanel.com',
    port: 80,
    path: '/email',
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(data)
    }
  };
  var req = http.request(options, function(res) {
    // Anything not a 200 is something we eshould simply bail on.
    if (res.statusCode != 200) return callback(res.status); 

    var data = '';
    res.on('data', function(c) { data += c });
    res.on('close', function(err) { callback(err) });
    res.on('end', function() { callback(undefined, data) });
  });
  req.end(data);
  req.on('error', function(err) {
    callback(e);
  });
};

exports.trackEmail = trackEmail;

