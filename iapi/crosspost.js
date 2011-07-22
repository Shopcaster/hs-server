var db = require('../db'),
    models = require('../models')
    templating = require('../templating'),
    settings = require('../settings'),
    http = require('http');


var do404 = function(res) {
  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

var showAll = function(req, res) {
  var query = {
    done: {$ne: true}
  };
  db.query(models.Listing, query, function(err, listings) {

    // Bail on errors
    if (err) {
      res.end(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Database Error');
      return;
    }

    // Sort by created
    listings.sort(function(a, b) {
      if (a.created === undefined)
        return -1;

      if (a.created > b.created)
        return 1;
      else if (a.created < b.created)
        return -1;
      else
        return 0;
    });

    // Walk through all the listings, and if they were modified more
    // than 10 minutes ago and have done set to `false`, clear it.
    for (var i=0; i<listings.length; i++) {
      var l = listings[i];                                   // 10m
      if (l.done === false && +l.modified < (+new Date() - 10 * 60 * 1000)) {
        l.done = null;
        db.apply(l);
      }
    }

    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(templating['crosspost_all'].render({listings: listings}));
  });
};

var showCrosspost = function(req, res) {
  var match = req.url.match(/(listing\/\d+)(\?done=true)?/);
  var id = match && match[1];

  // If we couldn't grab the id, we should bail
  if (!id) return do404(res);

  // Fetch the listing
  var listing = new models.Listing();
  listing._id = id;

  db.get(listing, function(err) {

    // If there's no such listing, bail out
    if (err) return do404(res);

    // Fetch the location from le goog
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

        // If `?done=true` was set, mark this listing as finished
        if (match[2]) {
          listing.done = true;
          db.apply(listing);

          // Redirect the user to the base crosspost page
          res.writeHead(303, {'Location': settings.serverUri + '/iapi/crosspost'});
          res.end();
          return;
        }

        // Set up the template context
        var context = {listing: listing};
        if (result && result.results && result.results[0])
          context.address = result.results[0].formatted_address;

        var title = listing.description
          .replace(/^\s*/, '')
          .replace(/\s*$/, '')
          .substr(0, 67)
          .split(' ');
        if (title.length > 1) {
          title.pop();
          title = title.join(' ')+'...';
        } else {
          title = title[0];
        }
        context.title = title;

        // Otherwise, serve up a straight HTML page with the listing
        res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
        res.end(templating['crosspost'].render(context));

        // Set done to false to signal that it's being edited
        if (!listing.done) {
          listing.done = false;
          db.apply(listing);
        }
      });
    });
  });
};

var serve = function(req, res) {
  if (req.url.match(/\/crosspost\/?$/)) return showAll(req, res);
  else return showCrosspost(req, res);
};

exports.serve = serve;
