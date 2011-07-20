var listings = require('./listings'),
    auth = require('./auth'),
    email = require('./email'),
    crosspost = require('./crosspost');


var serve = function(req, res) {
  var url = req.url.substr(6);

  if (url.match(/^listings/)) return listings.serve(req, res);
  if (url.match(/^crosspost\/\d+$/)) return crosspost.serve(req, res);
  if (url.match(/^auth/)) return auth.serve(req, res);
  if (url.match(/^email\/listing\/\d+$/)) return email.serve(req, res);

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.serve = serve;
