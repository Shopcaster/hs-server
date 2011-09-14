var querystring = require('querystring'),
    auth = require('../handlers/auth');

var serve = function(req, finish) {

  //only serve up GETs, since this endpoint just /checks/ auth
  if (req.method != 'GET') return finish(405, 'Method not allowed');

  //parse the query
  var q = querystring.parse(req.url.split('?')[1]);
  if (!q || !q.email) return finish(400, 'Bad request');

  // Try to auth
  auth.authUser(q.email, q.password, function(err, badPw, obj) {

    // If something went wrong with the db just throw an error
    if (err) return finish(500, 'Server error');

    // If we couldn't get a record for that email address, tell the
    // client the record doesn't exist, which will let them know that
    // they don't need to look for a password.
    if (!obj) return finish(404, 'Not found');

    // If the auth was successful, send success
    if (!badPw && obj) return finish(200, 'OK');

    // Otherwise, tell them they had an issue
    return finish(403, 'Not found');
  });

};

var signup = function(req, finish) {

  // Expect a POST
  if (req.method != 'POST') return finish(405, 'Method not allowed');

  // Read the body
  var email = '';
  req.on('data', function(c) { email += c });
  req.on('end', function() {

    // Make sure we actually have an email in the body data
    if (!email || email.indexOf('@') == -1) return finish(400, 'Bad request');

    // Check to see if the user exists
    auth.authUser(email, '', function(err, badPw, obj) {

      // Handle database errors with a 500
      if (err) return finish(500, 'Database error');

      // If we were passed back an auth object, we need to tell the
      // user that the email has already been registered.
      if (obj) finish(409, 'Email already registered');

      // Otherwise, we're ok to sign up the user
      auth.signup(email, function(obj, user) {
        return finish(201, obj.password);
      });
    });
  });
};

exports.serve = serve;
exports.signup = signup;
