var api;

var setup = function(r) {

  //import the library
  api = require('../../interface/load').zz;

  r.test('has zz', api);
  r.test('exports EventEmitter', !!api.EventEmitter);
  r.test('ping', ping);

  with(r.test('auth', auth)) {
    test('basic data', data);
    test('hot models', hotModels);
  }
};

var reconnect = function(r) {

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
  var defs = function(r) {
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
  };

  var operations = function(r) {
    // Test convo creation
    var d = r.defer('creates convo');
    api.create.convo({listing: 'listing/1'}, function(id) {
      d.done(!!id);

      // Test convo fetching
      d = r.defer('fetches convo');
      api.data.convo(id, function(convo) {
        d.done(!!convo);

        r.test('convo data correct', convo.listing == 'listing/1');
        r.test('convo type correct', convo._type == 'convo');
        r.test('date conversion happens', !!convo.created.getTime);

        // Test convo update
        d = r.defer('response when updates convo');
        api.update.convo(convo, {listing: 'listing/2'}, function() {
          d.done(true);

          // Fetch the data to check the results
          d = r.defer('updates convo data');
          api.data.convo(id, function(convo) {
            d.done(convo.listing == 'listing/2');
          });
        });
      });
    });

    // Test listing creation
    var d2 = r.defer('response when creates listing', 4000);
    api.create.listing({
      description: "MacBook Pro for sale. Excellent condition and fully loaded. 8GB RAM 64GB SSD. Must see. ",
      latitude: 43.651702,
      longitude: -79.373703,
      price: 1500,
      photo: 'R0lGODlhUAAPAKIAAAsLav///88PD9WqsYmApmZmZtZfYmdakyH5BAQUAP8ALAAAAABQAA8AAAPbWLrc/jDKSVe4OOvNu/9gqARDSRBHegyGMahqO4R0bQcjIQ8E4BMCQc930JluyGRmdAAcdiigMLVrApTYWy5FKM1IQe+Mp+L4rphz+qIOBAUYeCY4p2tGrJZeH9y79mZsawFoaIRxF3JyiYxuHiMGb5KTkpFvZj4ZbYeCiXaOiKBwnxh4fnt9e3ktgZyHhrChinONs3cFAShFF2JhvCZlG5uchYNun5eedRxMAF15XEFRXgZWWdciuM8GCmdSQ84lLQfY5R14wDB5Lyon4ubwS7jx9NcV9/j5+g4JADs='
    }, function(id) {
      d2.done(true);
      r.test('listings have pretty ids', id.match(/\w+\/\d+/));
    });

    // Non-existent data handling
    var d3 = r.defer('nonexistent data returns null');
    api.data.user('user/0000deadbeef', function(data) {
      d3.done(data === null);
    });
  };

  // Do the testing
  r.test('definitions', defs)
   .test('operations', operations);
};

var hotModels = function(r) {
  d = r.defer('model becomes hot');

  // Create a single model to play around with
  api.create.convo({listing: 'listing/1'}, function(id) {
    // Get the convo
    api.data.convo(id, function(convo) {
      // Heat it up
      convo.heat();
      d.done(convo.hot);
      // Register the change handler
      var didChange = r.defer('data updated on hot model');
      convo.on('listing', function(val) {
        didChange.done(val == 'listing/2');
        r.test('model updated', convo.listing == 'listing/2');

        // Freeze it
        convo.freeze();
        r.test('becomes cold', !convo.hot);
        r.test('freeze removes event handlers', !convo._listeners.length);
        r.test('freeze clears sub', !convo._sub);
      });
      // Make the change
      api.update.convo(convo, {listing: 'listing/2'});
    });
  });
};


exports.desc = 'API Interface Library Tests';
exports.run = function(r) {
  r.test('setup', setup);
};
