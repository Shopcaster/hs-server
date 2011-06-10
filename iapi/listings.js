var querystring = require('querystring'),
    models = require('./../models'),
    listings = require('./../handlers/data-handling/listing'),
    db = require('./../db');

var serve = function(req, res) {
  //only serve posts
  if (req.method != 'POST') {
    res.writeHead(405, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('Method Not Allowed');
    return;
  }

  //collect the data
  var data = '';
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', function() {

    //parse the data
    var q = querystring.parse(data);

    //do auth

    // TODO - actually do stuff
    res.writeHead(201, {'Content-Type': 'text/html; charset=utf-8'});
    res.end('TODO');
  });
};

exports.serve = serve;

