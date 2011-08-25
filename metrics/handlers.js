var db = require('../db'),
    models = require('../models');

var head = function(res, n) {
  res.writeHead(n, {'Content-Type': 'application/json'});
  return res;
};

var itemsSold = function(req, res) {
  console.log('item sold');

  db.query(models.Listing, {sold: true}, function(err, objs) {

    // Bail on error
    if (err) return head(res, 500).write('{"error": "Database error"}');

    // Sort the objects by created
    objs.sort(function(a, b) {
      return (+a.modified) - (+b.modified);
    })

    // Prepare the output
    var output = {};
    output.settings = {
      //axisy: ['Min', 'Max'],
      colour: 'ff9900'
    };
    output.item = [];

    // Segment into months
    var o = 0;
    var c = 0;
    for (var i=0; i<objs.length; i++) {
      var t = +objs[i].created;
      if (t - o > 1000 * 60 * 24 * 30) { // 30 days
        o = t;
        output.item.push(c + '');
        c = 0;
      }
      c++;
    }

    // Return success
    head(res, 200).end(JSON.stringify(output));
  })
};

var itemLocations = function(req, res) {
  db.query(models.Listing, {}, function(err, objs) {

    // Bail on error
    if (err) return head(res, 500).write('{"error": "Database error"}');

    // Prepare the output
    var output = {};
    output.points = {};
    output.points.point = [];

    // Add the locations
    for (var i=0; i<objs.length; i++) {
      if (!objs[i].location) continue;
      output.points.point.push({
        latitude: objs[i].location[0],
        longitude: objs[i].location[1]
      });
    }

    // Return success
    head(res, 200).end(JSON.stringify(output));
  });
};

exports.itemsSold = itemsSold;
exports.itemLocations = itemLocations;
