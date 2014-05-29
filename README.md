#http-proxy

HTTP proxy with caching functionalities

##Usage

```
var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  cache: {
    enabled: true, //defaults to false (no caching)
    path: "/path/to/cache/dir", (if enabled == true, this path must be specified, otherwise, an Error will be thrown. 
    ttl: 60000 //cache TTL
  }
});

httpProxy.listen(8080);
```
