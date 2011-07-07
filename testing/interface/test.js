var api;

var setup = function(r) {

  //import the library
  api = require('../../interface/load').spandex;
  r.test('has spandex', api);

  r.test('ping', ping);
  r.test('auth', auth);
};

var ping = function(r) {
  r.test('has ping', !!api.ping);

  var d = r.defer('receives response');

  api.ping(function() {
    d.done(true);
  });
};

var auth = function(r) {
  r.test('has auth', !!api.auth);
  r.test('has changePassword', !!api.auth.changePassword);

  var d = r.defer('signup response');
  api.auth('foo@bar.com', '12345', function(err, user) {
    d.done(true);

    r.test('signup succeeds', err);
    r.test('signup returns user', user);
    r.test('signup sets global user', spandex.auth.user && spandex.auth.user.email == 'foo@bar.com');

    d = r.defer('changePassword response');
    api.auth.changePassword('12345', '54321', function(err) {
      d.done(true);

      r.test('changePassword succeeds', err);
    });
  });
};


exports.desc = 'API Interface Library Tests';
exports.run = function(r) {
  r.test('setup', setup);
};
