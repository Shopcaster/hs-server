var http = require('http'),
    querystring = require('querystring');

var trackEmail = function(campaign, to, email, callback) {
  var data = querystring.stringify({
    body: email,
    token: '2a3e7cd1b6f051894a6937c956e28b73', // Main hipsell token
    campaign: campaign,
    distinct_id: to,
    type: 'html',
    redirect_host: 'mp.hipsell.me'
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
    if (res.statusCode != 200) return callback(email);

    var data = '';
    res.on('data', function(c) { data += c });
    res.on('close', function(err) { callback(email) });
    res.on('end', function() { callback(data) });
  });
  req.end(data);
  req.on('error', function(err) {
    callback(email);
  });
};

exports.trackEmail = trackEmail;

