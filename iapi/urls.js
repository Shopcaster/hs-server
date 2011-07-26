var listings = require('./listings'),
    auth = require('./auth'),
    email = require('./email'),
    share = require('./social/share'),
    connect = require('./social/connect');

var serve = function(req, res) {
  var url = req.url.substr(6);

  if (url.match(/^listings/)) return listings.serve(req, res);
  if (url.match(/^auth/)) return auth.serve(req, res);
  if (url.match(/^email\/listing\/\d+$/)) return email.serve(req, res);
  if (url.match(/^social\/share/)) return share.serve(req, res);
  if (url.match(/^social\/connect/)) return connect.serve(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
