var url = require('url'),
    querystring = require('querystring'),
    auth = require('./../handlers/auth'),
    oauth = require('./../util/oauth'),
    settings = require('./../settings'),
    db = require('./../db'),
    models = require('./../models'),
    common = require('./common');

var client = new oauth.OAuth('iXlFhLOOpd5WXZE_mTccdbF5mpe486hL9MHNvsxDMA7ZgbwFprLbpI-SFWOjIGqV',
                             'hTLF45CTWXX207ZHRUl2Y8tr5Y488cwiRlXKX3YC2-3pCSl0tHVYa_MmIzK45SeJ',
                             'https://api.linkedin.com', 'HMAC-SHA1');

var connect = function(req, res) {

  // Query params contain user info and such
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors by failing -- with class
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'})
      res.end('Bad username/password');
      return;
    }

    // Set up the "session"
    var s = new common.Session();
    s.auth = obj;
    s.ret = args['return'];

    // Fetch the temp OAuth token
    var callbackUrl = settings.uri + '/linkedin/callback?state=' + s.id;
    client.requestToken('/uas/oauth/requestToken', callbackUrl, function(err, token) {

      // Handle errors
      if (err) {
        console.log('Error at LinkedIn request token');
        console.log(err.stack);
        console.log('');

        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(err.message);
        return;
      }

      // Send the user to the authorization page
      var url = 'https://www.linkedin.com/uas/oauth/authorize?oauth_token=' + token.token;
      res.writeHead(302, {'Location': url});
      res.end();
    });

  });

};

// OAuth verification callback
var authCallback = function(req, res) {
  var args = querystring.parse(url.parse(req.url).query);

  // Verify that the session is valid and hasn't expired
  if (!common.sessions[args.state]) {
    console.log('Client returned from LinkedIn auth callback with invalid session');
    console.log('');

    res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Invalid session.');
    return;
  }

  // Fetch the session
  var session = common.sessions[args.state];
  delete common.sessions[args.state];

  // TODO - handle errors

  // Build the token
  var token = new oauth.Token(args.oauth_token);
  token.verifier = args.ouath_verifier;

  client.accessToken('/uas/oauth/accessToken', token, function(err, token) {

    // Handle errors
    if (err) return common.error(res, session.ret, 'Failed to authenticate with LinkedIn');

    // Save the oauth token on the user's record
    session.auth.linkedin_token = token.token;
    session.auth.linkedin_secret = token.secret;
    db.apply(session.auth);

    // Make the initial request to the LinkedIn API to get the data
    // we need to associate teh user, and then dave that data.
    api(session.auth, '', 'GET', null, function(err, data) {

      //

    });

    // TODO - fetch the user's info and update the user record
  });

};

// URL Dispatcher
var serve = function(req, res) {
  var url = req.url.substr(10); //strip leading /linkedin/

  if (url.match(/^connect/)) return connect(req, res);
  if (url.match(/^callback/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
