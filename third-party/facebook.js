var url = require('url'),
    https = require('https'),
    querystring = require('querystring'),
    settings = require('./../settings'),
    db = require('./../db'),
    models = require('./../models'),
    auth = require('./../handlers/auth'),
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

var authCallback = function(req, res) {
  var args = querystring.parse(url.parse(req.url).query);

  // Handle errors
  if (args.error) return common.error(res, session.ret, args.error);

  // Verify that the session is valid and hasn't expired
  if (!common.sessions[args.state]) {
    console.log('Client return from Facebook auth callback with invalid session');
    console.log('');

    res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Invalid session.');

    return;
  }

  // Fetch the session
  var session = common.sessions[args.state];
  delete common.sessions[args.state];

  // Now that we have an authorization code, we can get an access
  // token to the API
  var path = '/oauth/access_token' +
             '?client_id=' + APP_ID +
             '&client_secret=' + APP_SECRET +
             '&redirect_uri=' + querystring.escape(settings.uri + '/fb/callback') +
             '&code=' + args.code;

  graph(null, path, 'GET', null, function(err, data) {

    // Handle errors
    if (err) {
      console.log('Unable to fetch Facebook access token');
      if (data) console.log(data);
      console.log('');

      return common.error(res, session.ret, 'Unexpected error');
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

        return common.error(res, session.ret, 'Unable to fetch user data');
      }

      // Parse the data
      try {
        data = JSON.parse(data);
      } catch (err) {
        console.log('Bad JSON from graph API');
        console.log(data);
        console.log('');

        return common.error(res, session.ret, 'Bad data from Facebook');
      }

      // Store the link in the user's profile
      var user = new models.User();
      user._id = session.auth.creator;
      user.fb = data.link;
      db.apply(user);

      // Redirect back to the client
      return common.success(res, session.ret);
    });
  });
};

// Connects a user's account to a Facebook account
var connect = function(req, res) {

  // Query args contains relevant info
  var args = querystring.parse(url.parse(req.url).query);

  // Make sure the user supplied a valid email/password combo
  auth.authUser(args.email, args.password, function(err, bad, obj) {

    // Handle errors with, well, errors.
    if (err) return common.error(res, args['return'], 'Unexpected server error');

    // If the auth was incorrect or missing, throw out a 403
    if (bad || !obj) return common.error(res, args['return'], 'Incorrect login');

    // Set up the "session"
    var s = new common.Session();
    s.auth = obj;
    s.ret = args['return'];

    // Redirect the user to begin the flow
    var url = 'https://www.facebook.com/dialog/oauth' +
              '?client_id=' + APP_ID +
              '&redirect_uri=' + settings.uri + '/fb/callback' +
              '&state=' + s.id +
              '&scope=' + 'offline_access';

    res.writeHead(302, {'Location': url});
    res.end();
  });

};

// URL Dispatcher
var serve = function(req, res) {
  var url = req.url.substr(4); //strip leading /fb/

  if (url.match(/^connect/)) return connect(req, res);
  if (url.match(/^callback/)) return authCallback(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
exports.graph = graph;
