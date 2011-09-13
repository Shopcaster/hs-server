var querystring = require('querystring'),
    _url = require('url'),
    cors = require('../util/cors'),
    listings = require('./listings'),
    auth = require('./auth'),
    email = require('./email'),
    share = require('./social/share'),
    connect = require('./social/connect'),
    avatar = require('./avatar');

var serve = cors.wrap(function(req, res) {

  // Strip the leading /iapi/ for easier dispatching
  var url = req.url.substr(6);

  // Grab the query
  var query = _url.parse(req.url).query;
  query = query ? querystring.parse(query) : {};

  console.log(url, query);

  // If we have a return path, the error/success functions do redirects
  if (query['return']) {

    var finish = function(n, message) {

      // 302's are a special case, and we just want to pass
      // the redirect along.
      if (n == 302 || n == 303) {
        res.writeHead(n, {'Location': message});
        res.end();
        return;
      }

      // Figure out success/error based on the error code
      var arg = (n >= 200 && n < 300) ? 'success'
                                      : 'error';

      // Defaults for the message
      if (arg == 'success') message = message || 'true';
      else if (arg == 'error') message = message || 'Error';

      // Update the query
      var ret = _url.parse(query['return']);
      ret.query = ret.query ? querystring.parse(ret.query) : {};
      ret.query[arg] = message;
      ret.query = querystring.stringify(ret.query);
      ret.search = '?' + ret.query;

      // Write the response
      res.writeHead(303, {'Location': _url.format(ret)});
      res.end();
    };

  // Otherwise do plain vanilla responses
  } else {
    var finish = function(n, message) {

      // Handle redirects as a special case
      if (n == 302 || n == 303) {
        res.writeHead(n, {'Location': message});
        res.end('');
        return;
      }

      // Standard HTTP response
      res.writeHead(n, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end(message);
    };
  }

  if (url.match(/^listings/)) return listings.serve(req, finish);
  if (url.match(/^listing/)) return listings.serve2(req, finish);
  if (url.match(/^auth/)) return auth.serve(req, finish);
  if (url.match(/^signup/)) return auth.signup(req, finish);
  if (url.match(/^email\/\w+\/\d+$/)) return email.serve(req, finish);
  if (url.match(/^social\/share/)) return share.serve(req, finish);
  if (url.match(/^social\/connect/)) return connect.serve(req, finish);
  if (url.match(/^avatar/)) return avatar.serve(req, finish);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
});

exports.serve = serve;
