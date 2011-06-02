var FieldSet = require('./db').FieldSet;

var Auth = function() {};
Auth.prototype = new FieldSet('auth');

var Listing = function() {};
Listing.prototype = new FieldSet('listing');

var User = function() {};
User.prototype = new FieldSet('user');

var Offer = function() {};
Offer.prototype = new FieldSet('offer');

var Message = function() {};
Message.prototype = new FieldSet('message');

var Inquiry = function() {};
Inquiry.prototype = new FieldSet('inquiry');

exports.Auth = Auth;
exports.Listing = Listing;
exports.User = User;
exports.Offer = Offer;
exports.Message = Message;
exports.Inquiry = Inquiry;
