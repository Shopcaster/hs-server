var handlers = require('./handlers');

var urls = {
  '^/items-sold': handlers.itemsSold,
  '^/item-locations': handlers.itemLocations
};

var serve = function(req, res) {
  var url = req.url.substr(8);

  for (var r in urls) if (urls.hasOwnProperty(r)) {
    if (url.match(r)) {
      urls[r](req, res);
      return;
    }
  }

  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Metric Not Found');
};

exports.serve = serve;
