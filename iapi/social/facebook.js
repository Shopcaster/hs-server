var url = require('url'),
    https = require('https'),
    querystring = require('querystring'),
    settings = require('../../settings'),
    db = require('../../db'),
    models = require('../../models'),
    auth = require('../../handlers/auth'),
    common = require('./common');

var APP_ID = '110693249023137';
var APP_SECRET = '4a14e3f40c8a505912871d9a2ad28041';
var API_KEY = '5ee0a3ad7c486d64b7aa9d6c2518de0f';

var graph = function(auth, path, method, data, callback) {
  var headers = undefined;
  if (data)
    headers = {'Content-Length': Buffer.byteLength(data)};

  var options = {
    host: 'graph.facebook.com',
    port: 443,
    path: path + (auth && auth.fb ? '?access_token=' + auth.fb : ''),
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    var body = '';

    res.on('close', function(err) {
      console.log('Error receiving data from FB graph API');
      console.log(err.stack);
      console.log('');
      callback(err);
    });
    res.on('data', function(c) { body += c });
    res.on('end', function() {
      callback(res.statusCode == 400, body);
    });
  });

  if (data)
    req.write(data);
  req.end();
  req.on('error', function(err) {
    console.log('Error accessing FB graph API');
    console.log(err.stack);
    console.log('');
    callback(err);
  });
};

var callback = function(req, finish) {
  var args = querystring.parse(url.parse(req.url).query);

  // Verify that the session is valid and hasn't expired
  if (!common.sessions[args.state]) {
    console.log('Client return from Facebook auth callback with invalid session');
    console.log('');

    return finish(500, 'Invalid session');
  }

  // Fetch the session
  var session = common.sessions[args.state];
  delete common.sessions[args.state];

  // From here on, we have to use common's return functions rather than
  // using finish directly.  We have to do a manual redirect due to
  // the way oauth flow works; the original request had the `return`
  // query param set, but this redirect from Facebook doesn't.  Instead,
  // we use the return url stored in the session.

  // Handle errors
  if (args.error) return common.error(args.error, session.ret, finish);

  // Now that we have an authorization code, we can get an access
  // token to the API
  var path = '/oauth/access_token' +
             '?client_id=' + APP_ID +
             '&client_secret=' + APP_SECRET +
             '&redirect_uri=' + querystring.escape(settings.serverUri + '/iapi/social/connect/callback?type=fb') +
             '&code=' + args.code;

  graph(null, path, 'GET', null, function(err, data) {

    // Handle errors
    if (err) {
      console.log('Unable to fetch Facebook access token');
      if (data) console.log(data);
      console.log('');

      return common.error('Unexpected error', session.ret, finish);
    }

    // Parse the data
    data = querystring.parse(data);

    // Now that we have an access token, save it on the user's
    // auth object.
    session.auth.fb = data.access_token;
    db.apply(session.auth);

    // Make the initial request to the FB api to get the data
    // we can use to associate the user, and then save that data.
    graph(session.auth, '/me', 'GET', null, function(err, data) {

      // Handle errors
      if (err) {
        console.log('Unable to get FB user data');
        if (data) console.log(data);
        console.log('');

        return common.error('Unable to fetch user data', session.ret, finish);
      }

      // Parse the data
      try {
        data = JSON.parse(data);
      } catch (err) {
        console.log('Bad JSON from graph API');
        console.log(data);
        console.log('');

        return common.error('Bad data from Facebook', session.ret, finish);
      }

      // Store the link in the user's profile
      var user = new models.User();
      user._id = session.auth.creator;
      user.fb = data.link;
      db.apply(user);

      // Redirect back to the client
      return common.success('true', session.ret, finish);
    });
  });
};

// Connects a user's account to a Facebook account
var connect = function(req, finish) {

  // Query args contains relevant info
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors with, well, errors.
    if (err) return finish(500, 'Unexpected server error');

    // If the auth was incorrect or missing, throw out a 403
    if (bad || !obj) return finish(403, 'Incorrect login');

    // Set up the "session"
    var s = new common.Session();
    s.auth = obj;
    s.ret = args['return'];

    // Figure out of this is coming from a mobile browser by checking
    // the user agent string.
    var ua = req.headers['user-agent'];
    var isMobile = false;
    if (ua.match(/Mobile/))
      isMobile = true;

    // Redirect the user to begin the flow
    var url = 'https://www.facebook.com/dialog/oauth' +
              '?client_id=' + APP_ID +
              '&redirect_uri=' + querystring.escape(settings.serverUri + '/iapi/social/connect/callback?type=fb') +
              '&state=' + s.id +
              '&scope=' + 'publish_stream';
    // Add the mobile arg is neccessary
    if (isMobile)
      url += '&display=wap';

    finish(303, url);
  });

};

exports.connect = connect;
exports.callback = callback;
exports.graph = graph;
