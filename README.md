#http-proxy

HTTP proxy with caching support

##Usage

```javascript
var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  cache: {
    enabled: true, //defaults to false (no caching)
    path: "/path/to/cache/dir", //if `enabled` was set to true, this path must be specified, otherwise, an Error will be thrown. 
    ttl: 60000 //cache TTL
  },
  auth: "user:password" //Authorization credentials. Defaults to undefined (no authorization required)
});

httpProxy.listen(8080);
```

##Testing

```bash
~/http-proxy$ npm install
~/http-proxy$ npm test
```
