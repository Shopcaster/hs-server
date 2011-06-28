var oauth = require('oauth-client'),
    querystring = require('querystring'),
    settings = require('./../settings');

var client = oauth.createClient(443, 'api.twitter.com', true);
var consumer = oauth.createConsumer('TODO - key', 'TODO - secret');
var signer = oauth.createHmac(consumer);

var go = function() {
  var data = '';
  var token = oauth.createToken();

  var tokenRequest = client.request('POST',
                                    '/oauth/request_token?oauth_callback=' +
                                      querystring.escape(settings.uri + '/twitter/callback'),
                                    null,
                                    null,
                                    signer);
  tokenRequest.on('data', function(c) { data += c });
  tokenRequest.on('close', function(err) {
    console.log('Error fetching Twitter request token');
    console.log(err);
    console.log('');
  });
  tokenRequest.on('end', function() {

    // Handle errors
    if (res.statusCode != 200) {
      console.log('Error from API when fetching Twitter request token');
      console.log(data);
      console.log('');
      return;
    }

    // Grab the token
    token.decode(data);

    // Send the user to the URL to get the verifier
    var url = 'https://api.twitter.com/oauth/authorize?oauth_token=' + token.oauth_token;

    // TODO - generate temp id and attach it to the callback url so
    //        we can tie these disparate callbacks together

  });
};

// OAuth verification callback
var authCallback = function(req, res) {

  req.on('data')

};

// URL Dispatcher
var serve = function() {
  var url = req.url.substr(9); //strip leading /twitter/

  if (url.match(/^connect/)) return connect(req, res);
  if (url.match(/^callback/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};
