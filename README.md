#http-proxy

Chainable HTTP proxy with caching support

##Usage

###Launch proxy servers programmatically

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

###Launch proxy servers from the command line

```
$ node app.js --port 8080 --auth user:password --cluster
```

The options are:

- `--port` Port to listen to. By default a random port will be assigned.<br/>
- `--auth` Username and password. By default no authentication will be configured.<br/>
- `--cluster` If present, the proxy server will be clustered according to the number of available CPU cores.

##Testing

```bash
~/http-proxy$ npm install
~/http-proxy$ npm test
```
