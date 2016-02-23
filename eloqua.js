var fetch = require('node-fetch');
var duplex = require('duplexer2');
var through2 = require('through2');
var batch = require('batch-stream2');
var urltemplate = require('url-template');
var url = require('url');
var debug = require('debuglog')('eloqua');
var P = require('bluebird');
var qs = require('querystring');
var clone = require('clone');

fetch.Promise = P;

module.exports = function login(auth) {
  return fetchEloqua('https://login.eloqua.com/id', {
    headers: {
      'Authorization': auth
    }
  }).then(function(body) {
    if (typeof body == 'string')
      throw new Error(body);

    body.urls.apis.rest.standard1 = urltemplate.parse(body.urls.apis.rest.standard).expand({
      version: "1.0"
    })
    body.urls.apis.rest.standard2 = urltemplate.parse(body.urls.apis.rest.standard).expand({
      version: "2.0"
    })
    body.urls.apis.rest.bulk1 = urltemplate.parse(body.urls.apis.rest.bulk).expand({
      version: "1.0"
    })
    body.urls.apis.rest.bulk2 = urltemplate.parse(body.urls.apis.rest.bulk).expand({
      version: "2.0"
    })

    return new Client(body.urls, body.user, auth);
  });
};

function Client(urls, user, auth) {
  this.urls = urls;
  this.auth = auth;
  this.user = user;
  this.contactCache = {};
  this.pendingContacts = {};
}

Client.prototype.createExternalActivityCreationStream = function createExternalActivityCreationStream() {
  var client = this;

  return through2.obj(function(data, _, next) {

    client.postActivity(data).then(next, next)

  });
};

Client.prototype.postActivity = function postActivity(data) {
  var client = this;
  var activityPostingURL = url.resolve(this.urls.apis.rest.standard2, 'data/activity');

  return client.getContactId(data.emailAddress).then(function(ContactId) {

    var input = clone(data);
    delete input.emailAddress;
    input.contactId = ContactId;

    return client.POST(activityPostingURL, input).then(function() {
      return;
    })
  });
};

Client.prototype.getContactId = function getContactId(email) {
  var contactSearchURL = url.resolve(this.urls.apis.rest.standard1, 'data/contacts');
  var client = this;
  email = email.toLowerCase();
  return client.contactCache[email] ? P.resolve(client.contactCache[email]) : fetchOrCreate();

  function fetchOrCreate() {
    var searchURL = url.resolve(contactSearchURL, '?' + qs.stringify({
        search: email
      }));

    if (!client.pendingContacts[email]) {
      client.pendingContacts[email] = client.GET(searchURL).then(function(results) {
        if (results.elements && results.elements[0] && results.elements[0].emailAddress.toLowerCase() == email) {

          return client.contactCache[email] = results.elements[0].id;
        } else {
          return client.createContact(email).then(function(contact) {
            client.contactCache[email] = contact.id;
            return contact.id;
          });
        }
      }).finally(function() {
        delete client.pendingContacts[email]
      })
    }

    return client.pendingContacts[email];
  }
};

Client.prototype.createContact = function createContact(email) {
  var contactPostURL = url.resolve(this.urls.apis.rest.standard1, 'data/contact');
  return this.POST(contactPostURL, {
    emailAddress: email
  });
};

Client.prototype.createActivityImportStream = function createActivityImportStream() {
  var importName = 'import' + String(Date.now());
  var bulkUrl = this.urls.apis.rest.bulk2;
  var auth = this.auth;
  var client = this;

  return client.POST(url.resolve(bulkUrl, 'activities/imports'), {
    name: importName,
    fields: {
      //ContactId: "{{Activity.Contact.Id}}",
      EmailAddress: "{{Activity.Contact.Field(C_EmailAddress)}}",
      CampaignId: "{{Activity.Campaign.Id}}",
      ActivityType: "{{Activity.Type}}",
      AssetType: "{{Activity.Asset.Type}}",
      AssetDate: "{{Activity.CreatedAt}}",
      AssetName: "{{Activity.Asset.Name}}"
    },
    isSyncTriggeredOnImport: true,
    autoDeleteDuration: "P1D"
  }).then(function(importDef) {
    var out = through2.obj(function(data, _, next) {

      client.POST(url.resolve(bulkUrl, importDef.uri.slice(1) + '/data'), data).then(function(sync) {
        out.push(sync);
        return sync;
      }).then(function actOnSync(sync) {
        if (sync.status == 'pending') {
          return P.delay(Number(process.env.ELOQUA_SYNC_POLL_TIME || 10000)).then(function() {
            return client.GET(url.resolve(bulkUrl, sync.uri.slice(1)));
          }).then(actOnSync);
        } else if (sync.status == 'error') {
          return client.GET(url.resolve(bulkUrl, sync.uri.slice(1)) + '/logs').then(function(rejects) {
            var e = new Error("batch rejected");
            e.rejects = rejects;
            throw e;
          });
        } else {
          return sync;
        }

      }).then(function(r) {
        console.warn(r);
        next();
      }, next)
    });

    var b = new batch({
      timeout: 60000,
      size: 1000
    });

    b.pipe(out);

    var d = duplex({
      objectMode: true
    }, b, out);

    out.on('end', function() {
      d.emit('end');
    });

    return d;
  });



};

Client.prototype.POST = function POST(url, data) {
  var init = {
    method: 'POST',
    headers: {
      'Authorization': this.auth
    }
  };

  if (data) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(data);
  }

  return fetchEloqua(url, init);
};

Client.prototype.GET = function GET(url) {
  var init = {
    method: 'GET',
    headers: {
      'Authorization': this.auth
    }
  };

  return fetchEloqua(url, init);
};

module.exports.basic = function(c, u, p) {
  return 'Basic ' + (new Buffer(c + '\\' + u + ':' + p).toString('base64'));
};

module.exports.bearer = function(token) {
  return 'Bearer ' + token;
};

function getError(res) {
  return (res.headers['Content-Type'] == 'application/json' ? res.json() : res.text()).then(function(body) {
    var err = new Error(res.statusText);
    err.code = res.status;
    try {
      err.body = JSON.parse(body);
    } catch (e) {
      err.body = body;
    }
    debug('Error %j', err);
    throw err;
  });
}

function fetchEloqua(url, init) {
  if (init.method == 'POST') {
    debug('POST to %s headers %j body %s ', url, init.headers, init.body);
  } else if (init.method == 'GET' || !init.method) {
    debug('GET from %s headers %j', url, init.headers);
  } else {
    debug('%s to %s headers %j', init.method, url, init.headers);
  }

  return fetch(url, init).then(function(res) {
    if (!res.ok) {
      return getError(res);
    } else {
      return res.json().then(function(e) {
        debug('Recieved status %s headers %j body %j', res.status, res.headers, e);
        return e;
      });
    }
  });
}
