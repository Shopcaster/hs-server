var url = require('url'),
    querystring = require('querystring'),
    auth = require('./../handlers/auth'),
    oauth = require('./../util/oauth'),
    settings = require('./../settings');

var client = new oauth.OAuth('b9V0NzaBlCxbWdLz1OQT5A',
                             'XCinvLUCO07EcdQR2b9Vzb4yx0OSXgBUyPdOsMj8dc8',
                             'api.twitter.com', true);

// TODO - expired session handling (also in linkedin, facebook)

// Poor man's sessions
var sessions = {};

var connect = function(req, res) {

  // Query params contain user info and such
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors with, well, errors
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Bad username/password');
      return;
    }

    // Set up the "session"
    sessions[obj._id] = [obj, args.return];
    // Save memory by clearing the data after 20s, which should be
    // enough for anyone.
    setTimeout(function() {
      delete sessions[obj._id];
    }, 20 * 1000); //20s


    // Fetch the temp OAuth token
    var returnUrl = settings.uri + '/twitter/callback?state=' + obj._id;
    client.requestToken('/oauth/request_token', returnUrl, function(err, token) {

      // Handle errors
      if (err) {
        console.log('Error at Twitter request token');
        console.log(err.stack);
        console.log('');

        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(err.message);
        return;
      }

      // Send the user to the authorization page
      var url = 'http://api.twitter.com/oauth/authorize?oauth_token=' + token.token;
      res.writeHead(302, {'Location': url});
      res.end();
    });

  });

};

// OAuth verification callback
var authCallback = function(req, res) {
  var args = querystring.parse(url.parse(req.url).query);
  var sid = args.state;

  // TODO - handle errors

  // Build the token
  var token = new oauth.Token(args.oauth_token);
  token.verifier = args.ouath_verifier;

  client.accessToken('/oauth/access_token', token, function(err, token) {

    // Handle errors
    if (err) {
      console.log('Unable to authenticate with Twitter');

      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(err.message);
      return;
    }

    // If we have the token, we've pretty much succeeded
    console.log('Yo dawg, I heard you like tokens');
    console.log(token);
    console.log('');

    // TODO - store the token in the auth record
    // TODO - fetch the user's info and update the user record
    // TODO - redirect the user to the return url
  });

};

// URL Dispatcher
var serve = function(req, res) {
  var url = req.url.substr(9); //strip leading /twitter/

  if (url.match(/^connect/)) return connect(req, res);
  if (url.match(/^callback/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
