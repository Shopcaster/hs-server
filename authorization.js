//
//
//

// Abstract `give permissions` function
var give = function(type, user, perms) {
  if (!this[type]) this[type] = {};

  // If the user already has permissions, we need to merge the
  // new ones in.  However, if the permissions granted are 'all',
  // then we just want to set it and can fall through to the else.
  if (this[type][user] && perms != 'all') {
    // TODO - union

  // If they don't have permissions yet or the new permissions are
  // 'all', we can just set the array and be done with it.
  } else {
    this[type][user] = perms;
  }
};

var can = function(type, user, field) {

};

var Authorization = function() {
  this.readers = {};
  this.writers = {};
};
Authorization.prototype = {};
Authorization.prototype.giveRead = function(user) {
  var fields = Array.prototype.slice.call(arguments, 1);
  if (fields.length == 0) fields = 'all';

  return give.call(this, 'read', fields);
};
Authorization.prototype.giveWrite = function(user) {
  var fields = Array.prototype.slice.call(arguments, 1);
  if (fields.length == 0) fields = 'all';

  return give.call(this, 'write', fields);
};
