var FieldSet = require('./db').FieldSet,
    makeNiceId = require('./db').makeNiceId,
    crypto = require('crypto');

var Auth = function() {};
Auth.prototype = new FieldSet('authentication');

var Listing = function() {};
Listing.prototype = new FieldSet('item');
Listing.prototype.genId = function(callback) {
  var self = this;
  makeNiceId(this.getCollection(), function(id) {
    self._id = id;
    if (callback) callback();
  });

  return this;
};

var User = function() {};
User.prototype = new FieldSet('user');
User.prototype.genId = function(callback) {
  var self = this;
  makeNiceId(this.getCollection(), function(id) {
    self._id = id;
    if (callback) callback();
  });
};

var Offer = function() {};
Offer.prototype = new FieldSet('offer');

var Message = function() {};
Message.prototype = new FieldSet('message');

var Inquiry = function() {};
Inquiry.prototype = new FieldSet('inquiry');

var Convo = function() {};
Convo.prototype = new FieldSet('convo');

var File = function() {};
File.prototype = new FieldSet('staticfile');
File.prototype.generateHash = function() {
  this.hash = crypto.createHash('md5').update(this.data).digest('hex');
};

var ClientError = function() {};
ClientError.prototype = new FieldSet('clienterror');

exports.Auth = Auth;
exports.Listing = Listing;
exports.User = User;
exports.Offer = Offer;
exports.Message = Message;
exports.Inquiry = Inquiry;
exports.File = File;
exports.Convo = Convo;
exports.ClientError = ClientError;

// Expose the lowercase versions too
var list = [];
for (var i in exports) if (exports.hasOwnProperty(i))
  if (exports[i].prototype && exports[i].prototype instanceof FieldSet)
    list.push(i);
for (var i=0; i<list.length; i++)
  exports[list[i][0].toLowerCase() + list[i].substr(1)] = exports[list[i]];

// Manually map item -> Listing
//exports.item = Listing;
