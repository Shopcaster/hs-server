var cors = require('../util/cors'),
    auth = require('../handlers/auth'),
    db = require('../db'),
    models = require('../models'),
    external = require('../util/external'),
    querystring = require('querystring'),
    _url = require('url'),
    formidable = require('formidable'),
    fs = require('fs');

var ret = function(res, loc, field, val) {
  var url = _url.parse(loc);
  url.query = url.query ? querystring.parse(url.query) : {};
  url.query[field] = val;
  url.query = querystring.stringify(url.query);
  url.search = '?' + url.query;

  res.writeHead(303, {'Location': _url.format(url)});
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
    auth.authUser(fields.email, fields.password, function(err, badPassword, obj) {

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
        external.run('resize-avatar', data, function(err, avy) {

          // Handle errors by failing, like all good software should.
          if (err) {
            console.log('Error converting avatar:');
            console.log(res.toString());
            console.log('');
            return ret(res, fields.return, 'error', 'Error converting image');
          }

          // Create the new static file
          var f = new models.File();
          f.data = avy;
          f.mime = 'image/jpeg';
          f.generateHash();

          // Save it.
          db.apply(f, function() {

            // Update the user's avatar to point to the staticfile.
            var user = new models.User();
            user._id = obj.creator;
            user.avatar = f.getUrl();

            db.apply(user, function() {

              return ret(res, fields.return, 'success', 'true');
            });
          });

        });
      });
    });
  });
});

exports.serve = serve;
