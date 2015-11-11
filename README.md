eloqua-client
=============

Warning: Work in progress.

Implements just enough for my purposes, which is very specific. Contribution welcome for other aspects.

Use
----

```javascript
var eloqua = require('eloqua-client');
eloqua(eloqua.basic('companyname', 'username', 'password')).then(function (client) {
    somedatasource.pipe(client.createExternalActivityCreationStream());

    /* or */

    client.postActivity(activitydata).then(...)

    /* or */

    client.createContact(email).then(...)

    /* or */

    somedatasource.pipe(client.createActivityImportStream()) // Does not work with external activities, bulk API woes
});
```
