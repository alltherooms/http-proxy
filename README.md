#http-proxy

Chainable HTTP proxy with caching support

##Usage

###Instantiation

```javascript
var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  auth: "user:password", //Authorization credentials. Defaults to undefined (no authorization required)
  cache: {
    enabled: true, //defaults to false (no caching)
    path: "/path/to/cache/dir", //if `enabled` was set to true, this path must be specified, otherwise, an Error will be thrown.
    ttl: 60000 //cache TTL
  },
  proxy: "http://some.other.proxy:8181", //Other proxy to chain to
  maxSockets: 100 //http://nodejs.org/api/http.html#http_agent_maxsockets, defaults to Infinity
});

httpProxy.listen(8080);
```

###Sending a request

```javascript
var request = require("request")
,   options;

options = {
  uri: "http://google.com",
  proxy: "http://user:pass@localhost:8080" //"user:pass" is only required if the proxy has enabled authentication
};

request(options, callback);
```

###Timeouts

````javascript
var request = require("request")
,   options;

options = {
  uri: "http://google.com",
  proxy: "http://user:pass@localhost:8080",
  headers: {
    "proxy-timeout": 1000 //If you need the proxy server to handle a timeout, set this header specifying the number of milliseconds
  }
};

request(options, function (error, response, body) {
  if (response.statusCode === 504) {
    //A timeout occurred
    console.log(error); //-> undefined
  };
});
```
Please note that when a timeout occurs in the upstream server, no error will be thrown by the `request` module in userland, all that happens is the proxy server responds with `504 (Gateway timeout error)` which means: _The server was acting as a gateway or proxy and did not receive a timely response from the upstream server._

##Testing

```bash
~/http-proxy$ npm install
~/http-proxy$ npm test
```
