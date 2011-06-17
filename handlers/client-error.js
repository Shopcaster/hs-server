var db = require('./../db'),
    ClientError = require('./../models').ClientError;

var error = function(client, data, callback, errback) {

  // Set up the error log object
  var err = new ClientError();
  err.client = client.id;
  err.data = data.data;
  err.date = (new Date()) + '';
  if (client.state.auth && client.state.auth.creator)
    err.user = client.state.auth.creator;

  // Save it
  db.apply(err);

  // This must always return true
  callback(true);
};

exports.error = error;
