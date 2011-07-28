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

exports.serve = serve;
