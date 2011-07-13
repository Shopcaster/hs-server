var _validation = require('../util/validation'),
    _uuid = require('../util/uuid');

var validation = function(r) {

};

var uuid = function(r) {
  r.test('uuid4 is defined', !!_uuid.uuid4);
  r.test('uuid4 generates correct format', !!_uuid.uuid4().match(/[a-f0-9]{32}/));
};

exports.desc = 'Utility Tests';
exports.run = function(r) {
  r.test('uuid', uuid);
};
