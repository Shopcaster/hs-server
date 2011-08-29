
//
// The "Croquet Data Format"
//
// What this does is convert between straight up JSON and a more typed
// version.
//
var CDF = {};
CDF.to = function(o) {
  if (o === undefined)
    return {t: 0, v: undefined}

  if (o === null
  || typeof o == 'number'
  || typeof o == 'string'
  || typeof o == 'boolean')
    return {v: o}

  if (o instanceof Date)
    return {t: 1, v: +o}

  if (o instanceof Array) {
    var a = [];
    for (var i=0; i<o.length; i++)
      a.push(arguments.callee(o[i]));
    return {t: 2, v: a};
  }

  if (typeof o == 'object') {
    var obj = {};
    for (var i in o) if (o.hasOwnProperty(i))
      obj[i] = arguments.callee(o[i]);
    return {t: 3, v: obj};
  }

  throw new Error('Unable to convert data ' + o);
};
CDF.from = function(o) {
  switch (o.t) {
    case undefined: // not present = use JSON type
      return o.v;

    case 0: // undefined
      return undefined;

    case 1: // date
      return new Date(o.v);

    case 2: // array
      var a = [];
      for (var i=0; i<o.v.length; i++)
        a.push(arguments.callee(o.v[i]));
      return a;

    case 3: //object
      var obj = [];
      for (var i in o.v) if (o.v.hasOwnProperty(i))
        obj[i] = arguments.callee(o.v[i])
      return obj;

    default:
      throw new Error('Unknown type ' + o.t);
  }
};

var Message = function Message(type, data, id) {
  this.type = type;
  this.data = data;
  if (id) this.id = id;
};

var stringify = function(messages) {
  // Prep the JSON structure
  var obj = {messages: []};

  // Build the JSON
  for (var i=0; i<messages.length; i++) {
    var msg = {};

    msg.type = messages[i].type;
    msg.data = CDF.to(messages[i].data);
    if (messages[i].id)
      msg.id = messages[i].id;

    obj.messages.push(msg);
  }

  // Return its stringified form
  return JSON.stringify(obj);

};
var parse = function(str) {
  // Prepare out output list
  var ret = [];

  // Parse the JSON
  var msgs = JSON.parse(str).messages;

  // Convert the data
  for (var i=0; i<msgs.length; i++)
    ret.push(new Message(msgs[i].type, CDF.from(msgs[i].data), msgs[i].id));

  // And we're done
  return ret
};

exports.parse = parse;
exports.stringify = stringify;
