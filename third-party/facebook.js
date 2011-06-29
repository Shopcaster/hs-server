var url = require('url'),
    https = require('https'),
    querystring = require('querystring'),
    settings = require('./../settings'),
    db = require('./../db'),
    models = require('./../models'),
    auth = require('./../handlers/auth');

var APP_ID = '110693249023137';
var APP_SECRET = '4a14e3f40c8a505912871d9a2ad28041';
var API_KEY = '5ee0a3ad7c486d64b7aa9d6c2518de0f';

// Poor man's sessions
var sessions = {};

var graph = function(accessToken, path, method, data, callback) {
  var headers = undefined;
  if (data)
    headers = {'Content-Length': Buffer.byteLength(data)};

  var options = {
    host: 'graph.facebook.com',
    port: 443,
    path: path + (accessToken ? '?access_token=' + accessToken : ''),
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    var body = '';

    res.on('close', function(err) {
      console.log('Error receiving data from FB graph api');
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
    console.log('Error accessing FB graph api');
    console.log(err.stack);
    console.log('');
    callback(err);
  });
};

var authCallback = function(req, res) {
  var args = querystring.parse(url.parse(req.url).query);
  var sid = args.state;

  // Handle errors
  if (args.error) {
    res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(args.error);
  }

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

      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(data || err.toString());
      return;
    }

    // Parse the data
    data = querystring.parse(data);

    // Now that we have an access token, save it on the user's
    // auth object.
    var auth = sessions[sid][0];
    auth.fb = data.access_token;
    db.apply(auth);

    // Make the initial request to the FB api to get the data
    // we can use to associate the user, and then save that data.
    graph(auth.fb, '/me', 'GET', null, function(err, data) {

      // Handle errors
      if (err) {
        console.log('Unable to get FB user data');
        if (data) console.log(data);
        console.log('');

        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(data || err.toString());
        return;
      }

      // Parse the data
      try {
        data = JSON.parse(data);
      } catch (err) {
        console.log('Bad JSON from graph API');
        console.log(data);
        console.log('');

        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(data || err.toString());
        return;
      }

      // Store the link in the user's profile
      var user = new models.User();
      user._id = auth.creator;
      user.fb = data.link;
      db.apply(user);

      // Redirect back to the client
      res.writeHead(302, {'Location': sessions[sid][1]});
      res.end();
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
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end(err);
      return;
    }

    // If the auth was incorrect or missing, throw out a 403
    if (bad || !obj) {
      res.writeHead(403, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Bad username/password');
      return;
    }

    // Set up the "session"
    sessions[obj._id] = [obj, args.return];
    // Save memory by clearing data after 20s, which should be enough
    // for anyone.
    setTimeout(function() {
      delete sessions[obj._id];
    }, 20 * 1000); // 20s

    // Redirect the user to begin the flow
    var url = 'https://www.facebook.com/dialog/oauth' +
              '?client_id=' + APP_ID +
              '&redirect_uri=' + settings.uri + '/fb/callback' +
              '&state=' + obj._id +
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
