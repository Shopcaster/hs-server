var url = require('url'),
    querystring = require('querystring'),
    auth = require('../../handlers/auth'),
    oauth = require('../../util/oauth'),
    settings = require('../../settings'),
    db = require('../../db'),
    models = require('../../models'),
    common = require('./common');

var client = new oauth.OAuth('b9V0NzaBlCxbWdLz1OQT5A',
                             'XCinvLUCO07EcdQR2b9Vzb4yx0OSXgBUyPdOsMj8dc8',
                             'https://api.twitter.com', 'HMAC-SHA1');

var api = function(auth, path, method, data, callback) {
  var headers = undefined;
  if (data)
    headers = {'Content-Length': Buffer.byteLength(data)};

  // Build our oauth token
  var token = undefined;
  if (auth && auth.twitter_token && auth.twitter_secret)
    token = new oauth.Token(auth.twitter_token, auth.twitter_secret);

  // Force JSON mode
  path = path.split('?');
  path = path[0] + '.json' + (path.length > 1 ? '?' + path[1] : '');

  var options = {
    path: path,
    method: method,
    headers: headers,
    token: token
  };

  var req = client.request(options, function(res) {
    var body = '';

    res.on('close', function(err) {
      console.log('Error receiving data from Twitter API');
      console.log(err.stack);
      console.log('');
      callback(err);
    });
    res.on('data', function(c) { body += c });
    res.on('end', function() {
      try {
        body = JSON.parse(body);
      } catch(err) {
        console.log('Bad JSON from Twitter API');
        console.log(body);
        console.log('');

        return callback('Bad data from Twitter');
      }

      callback((res.statusCode != 200
             && res.statusCode != 201) ? res.statusCode : undefined,body);
    });
  });
  if (data)
    req.write(data);
  req.end();
  req.on('error', function(err) {
    console.log('Error accessing Twitter API');
    console.log(err.stack);
    console.log('');
    callback(err);
  });

};

var connect = function(req, finish) {

  // Query params contain user info and such
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors the same way we handle incorrect/missing auth.
    if (err || bad || !obj) return finish(403, 'Bad credentials');

    // Set up the "session"
    var s = new common.Session();
    s.auth = obj;
    s.ret = args['return'];

    // Fetch the temp OAuth token
    var returnUrl = settings.serverUri + '/iapi/social/connect/callback?type=twitter&state=' + s.id;
    client.requestToken('/oauth/request_token', returnUrl, function(err, token) {

      // Handle errors
      if (err) {
        console.log('Error at Twitter request token');
        console.log(err.stack);
        console.log('');

        return finish(500, 'Error fetching Twitter request token');
      }

      // Send the user to the authorization page
      var url = 'http://api.twitter.com/oauth/authorize?oauth_token=' + token.token;
      finish(302, url);
    });
  });
};

// OAuth verification callback
var callback = function(req, finish) {
  var args = querystring.parse(url.parse(req.url).query);

  // Verify that the session is valid and hasn't expired
  if (!common.sessions[args.state]) {
    console.log('Client returned from Twitter auth callback with invalid session');
    console.log('');

    return finish(500, 'Invalid session');
  }

  // Fetch the session
  var session = common.sessions[args.state];
  delete common.sessions[args.state];

  // From here on, we have to use common's return functions rather than
  // using finish directly.  We have to do a manual redirect due to
  // the way oauth flow works; the original request had the `return`
  // query param set, but this redirect from Twitter doesn't.  Instead,
  // we use the return url stored in the session.

  // TODO - handle errors from the oauth redirect (in the get args?)

  // Build the token
  var token = new oauth.Token(args.oauth_token);
  token.verifier = args.ouath_verifier;

  client.accessToken('/oauth/access_token', token, function(err, token) {

    // Handle errors
    if (err) return common.error('Failed to authenticate with Twitter', session.ret, finish);

    // Save the oauth token on the user's record
    session.auth.twitter_token = token.token;
    session.auth.twitter_secret = token.secret;
    db.apply(session.auth);

    // Make the initial request to the Twitter api to get the data
    // we need to associate the user, and then save that data.
    api(session.auth, '/1/account/verify_credentials', 'GET', null, function(err, data) {

      // Handle errors
      if (err) {
        console.log('Unable to get Twitter user data');
        if (data) console.log(data);
        console.log('');

        return common.error('Unable to fetch user data', session.ret, finish);
      }

      // Store the link in the user's profile
      var user = new models.User();
      user._id = session.auth.creator;
      user.twitter = 'http://twitter.com/' + data.screen_name;
      db.apply(user);

      // Redirect back to the client
      return common.success('true', session.ret, finish);
    });
  });

};

exports.connect = connect;
exports.api = api;
exports.callback = callback;
