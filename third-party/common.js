var querystring = require('querystring'),
    uuid = require('./../util/uuid');

var sessions = {};

var Session = function() {
  this.id = uuid.uuid4();
  sessions[this.id] = this;
  setTimeout(function() {
    delete sessions[this.id];

  }, 20 * 60 * 1000); // 20 min
};
Session.prototype = {};

var error = function(res, ret, message) {
  res.writeHead(302, {'Location': ret + '?error=' + querystring.escape(message)});
  res.end();
};
var success = function(res, ret) {
  res.writeHead(302, {'Location': ret + '?success=true'});
  res.end();
};

exports.error = error;
exports.success = success;
exports.Session = Session;
exports.sessions = sessions;
