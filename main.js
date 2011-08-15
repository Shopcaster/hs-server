#!/usr/bin/env node

var cli = require('cli'),
    http = require('http'),
    fs = require('fs'),
    // These bad boys don't get loaded off the bat.  Instead, we load
    // them as late as possible in the initialization sequence.  The
    // reason for this is that we don't want modules to be
    // accidentally included before they're initialized.  If they're
    // `required()` up here, the end result is that ALL of them will
    // be loaded before they're init'd.  Keeping the loading lazy
    // solves this problem and gives us fine-grained control over
    // initialization order.  Note that this isn't an academic
    // concern, and things actually break without this loading
    // technique.
    db,
    urls,
    email,
    clients,
    protocol,
    settings,
    querying,
    templating;

cli.parse({
  mode: [false, 'Server mode (development, production, staging, test)', 'string', 'lsettings.json'],
  port: ['p', 'Listen on this port', 'number', 8080],
  host: ['s', 'Listen on this hostname', 'string', '0.0.0.0'],
  dbhost: [false, 'Database server hostname', 'string', 'localhost'],
  dbport: [false, 'Database server port', 'number', 27017],
  dbname: [false, 'Database name', 'string', 'hipsell'],
  noemail: ['e', 'Disable email sending'],

  'server-uri': ['', 'Public facing server uri', 'string'],
  'client-uri': ['u', 'Public facing client server uri', 'string'],
  'compress-api-library': ['m', 'Enable compression of the api library']
});

cli.main(function(args, opts) {
  //convert dashes into camel case
  for (var arg in opts) if (opts.hasOwnProperty(arg)) {
    var t = opts[arg];
    delete opts[arg];
    while ((i = arg.indexOf('-')) >= 0) {
      m = arg.substr(i, 2);
      arg = arg.replace(m, arg[i+1].toUpperCase());
    }
    opts[arg] = t;
  }

  console.log('Hipsell Server');
  console.log('Running in mode ' + opts.mode);
  console.log('');

  //prep settings in the correct mode
  console.log('  Loading settings');
  settings = require('./settings');
  settings.init(opts);

  //parse the api library, to make sure there aren't any errors
  console.log('  Checking API library');
  try {
    require('uglify-js').parser.parse(fs.readFileSync('interface/api.js', 'utf8')
                                           .replace(/\/\*\$\w+\$\*\//, '""'));
  } catch (err) {
    console.log('    Syntax error in api library (' + (err.line+1) + ':' + err.col + ')');
    console.log('    ' + err.message);
    console.log('');
    process.exit(0);
  }

  //set up database
  console.log('  Initializing Database');
  db = require('./db');
  db.init(settings.dbhost, settings.dbport, settings.dbname, function() {

    //set up templating
    console.log('  Initializing Templating');
    templating = require('./templating');
    templating.init();

    //set up querying
    console.log('  Initialising Querying');
    querying = require('./querying');
    querying.init();

    //set up email
    console.log('  Initializing Email');
    email = require('./email')
    email.init(settings.noemail);

    //set up http
    console.log('  Initializing HTTP on ' + settings.host + ':' + settings.port);
    urls = require('./urls')
    var server = http.createServer(urls.dispatch);
    server.listen(settings.port, settings.host);

    //set up client listeners
    console.log('  Initializing Client Listener');
    clients = require('./clients');
    protocol = require('./protocol');
    clients.init(server, protocol.handle);

    //done
    console.log('');
    console.log('Server Ready');
    console.log('');

    // Handle uncaught exceptions without crashing the server.  Don't
    // move this any earlier, as we want failure during init to crash
    // it.
    process.on('uncaughtException', function(err) {
      console.log('Uncaught Exception!');
      console.log(err.stack);
      console.log('NOTE: There\'s a good chance we\'ve just leaked some ' +
                  'memory.  Restarting would be a good idea.');
      console.log('');
    });
  });
});
