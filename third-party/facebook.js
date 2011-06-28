var url = require('url'),
    http = require('http'),
    querystring = require('querystring'),
    settings = require('./../settings');

var APP_ID = '110693249023137';
var APP_SECRET = '4a14e3f40c8a505912871d9a2ad28041';
var API_KEY = '5ee0a3ad7c486d64b7aa9d6c2518de0f';

var generateAuthURL = function() {
  return 'https://www.facebook.com/dialog/oauth' +
         '?client_id=' + APP_ID +
         '&redirect_uri=' + settings.uri + '/fb/auth' +
         '&scope=' + 'offline_access';
};

var authCallback = function(req, res) {
  var args = querystring.parse(url.parse(req.url).query);

  // Handle errors
  if (args.error) {
    return; //todo
  }

  // Now that we have an authorization code, we can get an access
  // token to the API
  var accessReq = http.request({
    host: 'https://graph.facebook.com',
    port: 443,
    path: '/oauth/access_token' +
          '?client_id=' + APP_ID +
          '&client_secret=' + APP_SECRET +
          '&redirect_uri=' + settings.uri + '/fb/auth' +
          '&code=' + args.code,
    method: 'GET'
  }, function(res) {

    // Get the body data
    var data = '';
    // Handle errors
    res.on('close', function(err) {
      console.log('Error fetching facebook access token');
      console.log(err);
      console.log('');
    });
    res.on('data', function(d) { data += d });
    res.on('end', function() {

      // Handle errors
      if (res.statusCode == 400) {
        console.log('Error from API when fetching Facebook access token');
        console.log(data);
        console.log('');
        return;
      }

      data = querystring.parse(data);

      // TODO - stuff with the access token

    });

  });
  accessReq.end();
  accessReq.on('error', function() {
    console.log('Error fetching facebook access token');
    console.log(e.stack);
    console.log('');
  });

  // It's polite to send a response.
  write.writeHead(200 {'Content-Type': 'text/html; charset=utf-8'});
  write.end('OK');
};



// URL Dispatcher
var serve = function() {
  var url = req.url.substr(4); //strip leading /fb/

  if (url.match(/^auth/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};
