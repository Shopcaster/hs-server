var querystring = require('querystring'),
    cors = require('../util/cors'),
    auth = require('../handlers/auth');

var serve = cors.wrap(function(req, res) {

  //only serve up GETs, since this endpoint just /checks/ auth
  if (req.method != 'GET') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

  //parse the query
  var q = querystring.parse(req.url.split('?')[1]);
  if (!q || !q.email) {
    res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Bad Request');
    return;
  }

  // Try to auth
  auth.authUser(q.email, q.password, function(err, badPw, obj) {

    // If something went wrong with the db just throw an error
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Server Error');
      return;
    }

    // If we couldn't get a record for that email address, tell the
    // client the record doesn't exist, which will let them know that
    // they don't need to look for a password.
    if (!obj) {
      res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Not Found');
      return;
    }

    // If the auth was successful, send success
    if (!badPw && obj) {
      res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('OK');
      return
    }

    // Otherwise, tell them they had an issue
    res.writeHead(403, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Forbidden');
  });

});

var signup = function(req, res) {

  // Expect a POST
  if (req.method != 'POST') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

  // Read the body
  var email = '';
  req.on('data', function(c) { email += c });
  req.on('end', function() {

    // Make sure we actually have an email in the body data
    if (!email || email.indexOf('@') == -1) {
      res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Bad Request');
      return;
    }

    // Check to see if the user exists
    auth.authUser(email, '', function(err, badPw, obj) {

      // Handle database errors with a 500
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(err.message || err);
        return;
      }

      // If we were passed back an auth object, we need to tell the
      // user that the email has already been registered.
      if (obj) {
        res.writeHead(409, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end('Email already registered');
        return;
      }

      // Otherwise, we're ok to sign up the user
      auth.signup(email, function(obj, user) {
        res.writeHead(201, {'Content-Type': 'text/plain; charset=utf-8'});
        res.end(obj.password);
      });
    });
  });
};

exports.serve = serve;
exports.signup = signup;
