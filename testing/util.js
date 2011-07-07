var _functional = require('../util/functional'),
    _validation = require('../util/validation'),
    _uuid = require('../util/uuid');

var validation = function(r) {

};
var functional = function(r) {
  r.test('efilter', efilter);
};

var efilter = function(r) {
  r.test('is defined', !!_functional.efilter);
};

var uuid = function(r) {
  r.test('uuid4 is defined', !!_uuid.uuid4);
  r.test('uuid4 generates correct format', !!_uuid.uuid4().match(/[a-f0-9]{32}/));
};

exports.desc = 'Utility Tests';
exports.run = function(r) {
  r.test('functional', functional);
  r.test('uuid', uuid);
};
