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
      photo: '47494638396130003000f7ff00d7a4a4cccbcbdbb8b8d31b14ed452cc3cdceab1713fcfcfc68080abcc3c3d2d2d2e5c8c8a5797afefefec4a9a9590709f4fbfbbc2728c97678da241bc7241bd76464da2c23990b0dfafafae5e5e5d54847f2f2f2e9e9e9edededb34345d4231bf6f6f6d9d9d9c4110ec314118a0c0dcad2d3e1bebff4f4f4c34849c73636e23223b58182f8f8f8bc0d0cab0b0ccb9189ea3b29920b0da40b0cd1cfcf9b1618a95759722a2bc1c4c4ffffffe42b1ff0f0f0994849c76a6cd65555c40b0adc3325c757587c090ba92326f4e9e9e07676823839e7f7f7dce2e2cc8282cd8b85c31f1cebd9d9bbbcbc831214bd898ab30c0dbd1411cb2524b68a8ae02b20822426d29e9fcdc4c4d4ddddc9bcbcbc5a5c82090ae93323ac0203ca1411a66969957778cc2c24e4402cdedede9a5657ddd4d4d63626ad8283ad3336d12721ece1e1c65e604f0506a5100fe0271de2e2e2e4eaeaee3b26b39293c7d1d2bbacac71080ac99b95f8ffffc11915771f20b31413c6b5b5c19d9dca1914bc3a3b8c1b1ee0dcdcd7291feff5f5dd271ecab1b1d32c21c22422950304c12c2ce7cfd0a50000e01b11cc8b8cc19392bca6a6c6cfd0f4f6f7d28b8cb6a3a3bb696a933638b11b1bd47577b27d7dcd1e19ead6d6ba100fe92b1bc59993b8bdbdae898abe1e19c7807d9b1110b9221f854344b49c9db6adadfbffffbeb4b4b48687b51915d9322ec0bebeba9191eaececfeffffefeaeaf2f3f3dc160ef7f0f0e0e5e5e28a8ab16e6fe42014b40606ca9692d73937af0709e8e7e7f1f2f2e63827a51e20bd1a15de3827dd3c2bb7b0b0a68081f7f7f7dbdbdb9f090bddafb0b12c2ecc2f2eefefefd80f09a77172e2e8e8d81f17a00001f5f5f5f6f5f5f6f5f6f6f6f59320229b3133f3f3f3b78888bc8580f9f9f9faf9f9faf9fafafaf9d43121f1f1f1f2f2f1c38a84c5908df4f3f4cd8687d9e1e18400008f0909d8dfdfbd8e8ee0d9d9eb2f1fad0f10b91718bb9e9ed6d7d7f0eff0e72619d6312e6c1d1fcd7f80720f11be0706b80908d16f6fc44e4ffbfbfb6f0000c43f407b0305fcfbfbb9b7b8c3c9c9d4d4d421f904010000ff002c00000000300030000008ff00ff091c48b0e0402b0e3649b1c6d05a27460eac189c48b1e2402cab3a8d0ac62981c78ffd48c539b54aa2c59306079989f4f186bf000166cc8079e323933866f4a04489c50c298f37da71d880a1418356460f0cd3916146cd1b915698dc6970d5a804aa02646081a3abd1af46bbe268b08158cd0471d8512518c04c3f4e37dce0c371a0aeddbb781be000d18e4902522bd6fec342ad13277fc91ae0c380019fe3c7901f33c6503783aa045f6accd849d89019472730b0c0467adbe4d3a84993667180438265f9766cb61860d20567d6020d03318c85efd1aa83031fce62183416cc9691a353e3648d0bc5b80880b0e18434dec3b26bdfce3d3b8867d5bcd9ff0167480b024b1585c52896485f9a643aaa3f0341bf3e7deff6eb473bb1a143a005ea1812c43c7b4c84050d17b8c0452569b0d24137d59cf0cc84143e33cc12ee405321852754d34d07ac2ca18f33e5d031c96c048d71810cb964320b221cb0920c8427d468e3098f1883090b37dae861321cbc8148055c14639e300591024a312ed8a2c42c0b30c34107f145c81f8e8fb80289311054f3c806e154534d381be8d0812ecc2c600f3d2e9448450029aef8043d851061822c19b0a243371b6c50cd2b26b862870912c893861d4b20f2e52b1b74930c2b19c86242053e3c612402480a74e0054fb4d04217761e91010733f6b90104c620014025f6d8b3a53c987cffd9e7871cb87184003df8d0429b7414319b7a32742a820f3d08608e1b53c6c7e82398a8a14605d0aa0184043af0d7a799bab8618e31a9f820c213170481800302ed90600b2274a14c2ac65c21862e5476f3cabcaef0704f0ff8f6700f2410e8f0c82bdd9899811857003040175db4208379cbfc13c0349c6692ee00b054e1ae8cdd3c53451a2740208f3e1a847c8f3e5c32aba83bace8423024ca1c2c429b0888f24f2331043b421703500cce152108a00b047648f0090410009042c81ae0d2072210bc9285317640d0013a6294f0092c398ff0440c74e0810523e5c890c9087c0cd08c22e0c87184241e2cb2801a420860c7028720830b2ec8a020e822bddcff8249155954214b019f28d2cc007c6472011d0834424b0c2e6482733313d4024e01e300d00b25111c124a1fae6052772af01452811dc684d27904941c43463b84d73241337c402143100f9c5303e450943d411bef80e3483b641c5348146844e14b0f2680818605165c620f22872811c5f5eb64c18c020520518b20130c00051b5a3cb0c2eeea90fd8120396872f938e884d2c507160082c625ce0302bdfd515c8286fe1fa007108c608eeebd630a82b8c41dc8f7004ba06f0497f8c01454908e5bf84312677842179ad18636806f028268c3143c38811286b00dcd1001253ce084022441132a10c40716583e07c6207d9700c414b6b0855bc861104248c408ff389883221af188476cc30046e00c2138400e4948870aa6304336e06e05b420813aee904315f0020eb77004fc3cc085114c60873c4ca31ab730c50f88800b59f8c3385cb8055ea8000d770005eece710e12c8808b8450010cc0383c56040209b91801200439c846c2619076fc400bf2500508bc01764980032f7e80065f80820e0f684423fcb88e1cfe220c70a883234290815794c218a81881057801835adab296bc00440b96560aa6c0ee058fe4242a6280807860c10a7eb8401e2e418853124095acd4c13070808850f0e17980d05ffdf627827bc4a201204846064250006086e107144005091e500405fc63073754021a7e418067ae5217bb6001065ac1ff8344d8a2059e28c41d94500828d4a31e8900000e30b094713ae205043867210c1084357841200c20011b7c81863284e1997220862e36a04f1cf0e0183c30c61286700c7bc46201f2f0001bc4b1d06174639ce58c28373c010a04aca140ff3045139449018fda53a4d5c0c601f031847de2a01538f08038c2d28a210c61a92ce8862e42f0500200030c0658a70d50348672b041098400064889c1816a50e60049a94b549140970394022975c1c606b6fad03094a1107a5c43c306e280205c0015450d431d42dad6b7e6c50374c54b5db6b157aebee0ab9458673ca6522e8d7a020cc0d84409d81a1ac91e60ae75c50b06aac1d7177023149f14ac41e6d08418ff188002dc102d69f1615a1c9c411ea9bdcb6a39400c477c8302147d800d383b105a1816b18c28811838f00c7c80e52b38300126c6725dc55483b872b846587d1a878aec2008a040c53946cb811358b7bb7ae16e7757bb553958a21c3ebd6845b040852014430af7dc8036e00a5ff8d68505be740403f2b10651a0882283a0c23ecce00f05b8a10320786b81c152170c3ca3036298813fbeb086223017c25410460202c0ca643c633476e96e5df0818d619ca0031968873f6ef00513af050b2abec10c8891012a55c342d8608c6330908de23c6303407243080270837e30004e8299811448f192768861541d808f9fc4d42833a5cc0d6250808847515ec110646b0e9d50851c14d08e1088c10d19d0859ef59c810ca039040a28410182b1029db8b9200a1845274c5180122880ce218874a4dbd18e47cbc11f913805b90e5d110774220e7348803fe4508252cbc111fe6042233a718a41707a270ad0c31e16728a5a33c4097bd0833b051310003b'
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
