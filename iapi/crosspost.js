var db = require('../db'),
    models = require('../models')
    templating = require('../templating')
    http = require('http');


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

    var context = {listing: listing};

    var title = listing.description
      .replace(/^\s*/, '')
      .replace(/\s*$/, '')
      .substr(0, 67)
      .split(' ');
    title.pop();
    title = title.join(' ')+'...';
    context.title = title;

    http.get({
      host: 'maps.googleapis.com',
      port: 80,
      path: '/maps/api/geocode/json?'
        +'latlng='+listing.latitude+','+listing.longitude
        +'&sensor=false'
    }, function(gRes) {
      var result = '';

      gRes.on('data', function(data){
        if (data) result += data;
      });

      gRes.on('end', function(){
        result = JSON.parse(result);

        context.address = result.results[0].formatted_address;

        // Otherwise, serve up a straight HTML page with the listing
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(templating['crosspost'].render(context));
      });
    });
  });
};

exports.serve = serve;
