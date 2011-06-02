// Functional helpers for Javascript in general

Function.prototype.curry = function() {
  var f = this;
  var args = Array.prototype.slice.call(arguments);

  return function() {
    f.apply(this, args.concat(Array.prototype.slice.call(arguments)));
  };
};

// How to use:
//
// //handle a filtered event
// var killer = efilter(foo, 'someEvent')
//   (function(bar) { return bar.isSnazzy })
//   (function(bar) { return !bar.isUgly })
//   .run(function(bar) {
//     //handle event
//   });
//
// //remove the listner
// killer.kill();
//
var efilter = function(obj, type) {
  var filters = [];
  var callback = null;
  var runIt = function() {
    //no point in doing anything if the callback is null
    if (!callback) return;
    //only execute the callback if all the filters pass
    for (var i=0; i<filters.length && filters[i].apply(this, Array.prototype.slice.call(arguments)); i++);
    //if we made it all the way through, fire the callback
    if (i == filters.length) callback.apply(this, Array.prototype.slice.call(arguments));
  };

  //attach the listener
  if (typeof type == 'string')
    obj.on(type, runIt);
  else if (typeof type == 'object' && type.length)
    for (var i=0; i<type.length; i++)
      obj.on(type[i], runIt);
  else
    throw new Error('Don\'t understand event: ' + type);

  var ret = function(predicate) {
    if (predicate)
      filters.push(predicate);
    return ret;
  };
  ret.run = function(clbk) {
    callback = clbk;
    return {kill: function() {
      obj.removeListener(type, runIt);
    }};
  };

  return ret;
};

exports.efilter = efilter;

