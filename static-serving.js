var db = require('./db'),
    models = require('./models');

var serve = function(req, res) {
  // Strip the opening slash as well as any extension
  id = req.url.substr(1).split('.')[0];

  var s = db.queryOne(models.File, {_id: id}, function(err, file) {
    //handle database errors
    if (err) {
      res.writeHead(500, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Database Error');

    //handle no matching hash
    } else if (!file) {
      res.writeHead(404, {'Content-Type': 'text/html; charset=utf-8'});
      res.end('Not Found');

    //serve the content
    } else {
      //use the file's built in mimetype
      res.writeHead(200, {'Content-Type': file.mime});
      res.write(new Buffer(file.data));
      res.end();
    }
  });
};

exports.serve = serve;
