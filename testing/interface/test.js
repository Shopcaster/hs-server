var api;

var setup = function(r) {

  //import the library
  api = require('../../interface/load').zz;

  r.test('has zz', api);
  r.test('ping', ping);

  with (r.test('auth', auth)) {
    test('data', data);
  }
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

  var d = r.defer('signup response', 0);
  api.auth('foo@bar.com', '12345', function(err) {
    d.done(true);

    r.test('signup succeeds', !err);
    r.test('signup sets global user', api.auth.curUser());

    d = r.defer('changePassword response');
    api.auth.changePassword('12345', '54321', function(err) {
      d.done(true);

      r.test('changePassword succeeds', err);
      r.test('changePassword password changed');
    });
  });
};

var data = function(r) {
  var dataTypes = [
    'listing',
    'offer',
    'user',
    'convo',
    'message',
    'inquiry'
  ];

  r.test('data defined', api.data);
  r.test('create defined', api.create);
  r.test('update defined', api.update);

  // Check appropriate defines
  for (var i=0; i<dataTypes.length; i++) {
    var type = dataTypes[i];
    var utype = type[0].toUpperCase() + type.substr(1);

    r.test('has ' + type + ' data fetcher', !!api.data[type]);
    r.test('has ' + type + ' creator', !!api.create[type]);
    r.test('has ' + type + ' updater', !!api.update[type]);
    r.test('has ' + utype + ' model', !!api.models[utype]);
  }

  api.data.convo('convo/123123', function() {});

  // Test creation
  var d = r.defer('creates convo');
  api.create.convo({listing: 'listing/1'}, function(id) {
    d.done(!!id);

    // Test fetching
    d = r.defer('fetches convo');
    api.data.convo(id, function(convo) {
      d.done(!!convo);

      r.test('convo data correct', convo.listing == 'listing/1');

      // Test update
      d = r.defer('response when updates convo');
      api.update.convo(convo, {listing: 'listings/2'}, function() {
        d.done(true);

        // Fetch the data to check the results
        //d = r.defer('updates convo data');
        //api.data.convo(id, function(convo) {

        //  d.done(convo.listing == 'listing/2');
        //});
      });
    });
  });
};


exports.desc = 'API Interface Library Tests';
exports.run = function(r) {
  r.test('setup', setup);
};
