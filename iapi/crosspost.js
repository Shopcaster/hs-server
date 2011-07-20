var db = require('../db'),
    models = require('../models')
    templating = require('../templating');


var do404 = function(res) {
  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

var serve = function(req, res) {
  var match = req.url.match(/\/\d+$/);
  var id = match && 'listing' + match[0];

  // If we couldn't grab the id, we should bail
  if (!id) return do404(res);

  // Fetch the listing
  var listing = new models.Listing();
  listing._id = id;
  db.get(listing, function(err) {

    // If there's no such listing, bail out
    if (err) return do404(res);

    // Otherwise, serve up a straight HTML page with the listing
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(templating['crosspost'].render({listing: listing}));
  });
};

exports.serve = serve;
