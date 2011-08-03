var FieldSet = require('./db').FieldSet,
    makeNiceId = require('./db').makeNiceId,
    crypto = require('crypto');

var make = function(collection, c) {
  var F = c || function() {};
  F.prototype = new FieldSet(collection);
  F.prototype.constructor = F;

  return F;
};

var Auth = make('authentication');

var Listing = make('item');
Listing.prototype.genId = function(callback) {
  var self = this;
  makeNiceId(this.getCollection(), function(id) {
    self._id = id;
    if (callback) callback();
  });

  return this;
};

var User = make('user');
User.prototype.genId = function(callback) {
  var self = this;
  makeNiceId(this.getCollection(), function(id) {
    self._id = id;
    if (callback) callback();
  });
};

var Offer = make('offer');
var Message = make('message');
var Inquiry = make('inquiry');
var Convo = make('convo');
var ClientError = make('clienterror');
var File = make('staticfile');
File.prototype.generateHash = function() {
  this.hash = crypto.createHash('md5').update(this.data).digest('hex');
};

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
exports.item = Listing;
