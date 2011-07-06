var functional = require('../util/functional'),
    validation = require('../util/validation'),
    uuid = require('../util/uuid');

var validation = function(r) {

};
var functional = function(r) {
  r.test('efilter', efilter);
};

var efilter = function(r) {
  r.test('is defined', !!functional.efilter);

};

var uuid = function(r) {
  r.test('is defined',
};

var foo = function(r) {
  var d = r.defer('does something async');
  r.done(true);
};

exports.run = function(r) {
  r.test('functional', functional);
  r.test('validation', validation);
  r.test('efilter', efilter);
  r.test('uuid', uuid);
};
