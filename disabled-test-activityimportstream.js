var tap = require('tap');
var eloqua = require('./eloqua');

var dotenv = require('dotenv');
dotenv.load();

tap.test('test eloqua', function(t) {
  eloqua(eloqua.basic(process.env.ELOQUA_COMPANY, process.env.ELOQUA_USERNAME, process.env.ELOQUA_PASSWORD)).then(function(client) {
    t.test('client properties', function(t) {
      t.ok(client, 'got client');
      t.match(client.urls.base, /^https:\/\/secure\..*\.eloqua\.com$/i, 'got pod url');
      t.end();
    });

    t.test('writable activity import stream', function(t) {
      t.equal(typeof client.createActivityImportStream, 'function');
      client.createActivityImportStream().then(function(stream) {
        t.equal(typeof stream, 'object', 'stream is an object');
        t.test('write', function(t) {
          stream.write({
            EmailAddress: "blackhole+test@npmjs.com",
            ActivityType: "Publish",
            AssetType: "Package",
            AssetName: "test"
          });
          stream.write({
            EmailAddress: "blackhole+test@npmjs.com",
            ActivityType: "Publish",
            AssetType: "Package",
            AssetName: "test2"
          });
          stream.end();
          stream.once('error', function(err) {
            t.error(err);
            t.end();
          });
          stream.once('end', function() {
            t.pass('Got the end');
            t.end();
          });
        });
      }).catch(t.fail).then(function() {
        t.end();
      });

    });
  }).catch(t.error).then(t.end);
});
