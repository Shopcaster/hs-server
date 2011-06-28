var OAuth = require('oauth').OAuth;

var oa = new OAuth('http://api.twitter.com/oauth/request_token',
                   'https://api.twitter.com/oauth/access_token',
                   'TODO - key',
                   'TODO - secret',
                   '1.0',
                   'TODO - url callback',
                   'HMAC-SHA1');

var go = function() {
  oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {

    // Handle errors
    if (error) {
      console.log('Error fetching Twitter request token');
      console.log(error);
      console.log('');
      return;
    }


  }));
};

var authCallback = function(req, res) {

};

// URL Dispatcher
var serve = function() {
  var url = req.url.substr(9); //strip leading /twitter/

  if (url.match(/^callback/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};
