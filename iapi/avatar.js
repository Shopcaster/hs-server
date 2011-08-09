var cors = require('../util/cors'),
    auth = require('../handlers/auth'),
    db = require('../db'),
    models = require('../models'),
    querystring = require('querystring'),
    formidable = require('formidable'),
    fs = require('fs');

var ret(res, loc, field, val) {
  val = querystring.stringify(val);

  res.writeHead(303, {'Location': loc + '?' + field + '=' + val});
  res.end('');
}

var serve = cors.wrap(function(req, res) {

  // Only serve POSTs.
  if (req.method != 'POST') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

  // Get all formidable up in here
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {

    // Make sure the fields we need are there
    if (!fields.email || !fields.password || !fields.return || !files.avatar) {
      res.writeHead(400, {'Content-Type': 'text/html; charset=utf-8'});
      res.writeHead('Missing field');
      return;
    }

    // Grab the user.
    auth.authUser(email, password, function(err, badPassword, obj) {

      // Database errors are bad
      if (err) return ret(res, fields.return, 'error', 'Database error');
      // As are bad logins
      if (badPassword || !obj) return ret(res, fields.return, 'error', 'Bad login');

      // Now that we have a legit user, read the avatar file
      // Read the file in.
      fs.readFile(files.avatar.path, function(err, data) {
        // Fail on error
        if (err) return ret(res, fields.return, 'error', 'Database error');

        // Resize the avatar
        // TODO

        // Save it into a staticfile

        // Update the user's avatar url to point to that staticfile

        // Finally, return success
      });
    });
  });
});

exports.serve = serve;
