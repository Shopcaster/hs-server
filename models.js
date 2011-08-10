var FieldSet = require('./db').FieldSet,
    makeNiceId = require('./db').makeNiceId,
    db = require('./db'),
    settings = require('./settings'),
    crypto = require('crypto');

var make = function(collection, options, c) {

  // Magic args
  if (typeof options == 'function') {
    c = options;
    options = {};
  }
  options = options || {};

  // Generate the object
  var F = c || function() {};
  F.prototype = new FieldSet(collection);
  F.prototype.constructor = F;

  // Ensure geoindex
  if (options.geo)
    db.ensureIndex(collection, options.geo, '2d');

  return F;
};

var Auth = make('authentication');

var Listing = make('item', {geo: 'location'});
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
var OutgoingEmail = make('outgoingemail');
var IncomingEmail = make('incomingemail');
var File = make('staticfile');
File.prototype.generateHash = function() {
  this.hash = crypto.createHash('md5').update(this.data).digest('hex');
};
File.prototype.getUrl = function() {
  return settings.serverUri + '/' + this._id;
};

var AwaitedSMS = make('awaitedsms');

exports.Auth = Auth;
exports.Listing = Listing;
exports.User = User;
exports.Offer = Offer;
exports.Message = Message;
exports.Inquiry = Inquiry;
exports.File = File;
exports.Convo = Convo;
exports.ClientError = ClientError;
exports.IncomingEmail = IncomingEmail;
exports.OutgoingEmail = OutgoingEmail;
exports.AwaitedSMS = AwaitedSMS;

// Expose the lowercase versions too
var list = [];
for (var i in exports) if (exports.hasOwnProperty(i))
  if (exports[i].prototype && exports[i].prototype instanceof FieldSet)
    list.push(i);
for (var i=0; i<list.length; i++)
  exports[list[i][0].toLowerCase() + list[i].substr(1)] = exports[list[i]];

// Manually map item -> Listing
exports.item = Listing;
