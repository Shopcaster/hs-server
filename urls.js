var staticServing = require('./static-serving'),
    iapi = require('./iapi/urls'),
    facebook = require('./third-party/facebook'),
    twitter = require('./third-party/twitter'),
    linkedin = require('./third-party/linkedin'),
    fs = require('./fs');

// Serves an individual file
var file = function(file, type) {
  return function(req, res) {

    res.writeHead(200, {'Content-Type': type});
    fs.readFile(file, function(err, data) {
      if (err) {
        res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
        res.end('Server error');
      } else {
        res.writeHead(200, {'Content-Type': type})
        res.end(data);
      }
    });
  };
};

var urls = {
  //dummy handler that keeps us from clobbering socket.io's urls
  '^/socket.io/': function() {},
  //serve File objects from the db
  '^/static/': staticServing.serve,

  //serve the api library
  '^/api-interface.js': file('interface/api.js'),

  //delegate to the internal api
  '^/iapi/': iapi.serve,

  //oauth callbacks
  '^/fb/': facebook.serve,
  '^/twitter/': twitter.serve,
  '^/linkedin/': linkedin.serve
};

var dispatch = function(req, res) {

  //try to dispatch
  for (var r in urls) if (urls.hasOwnProperty(r)) {
    if (req.url.match(r)) {
      urls[r](req, res);
      return;
    }
  }

  //on failure, 404
  res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
  res.end('Not Found');
};

exports.dispatch = dispatch;
