#http-proxy

Chainable HTTP proxy with tunneling support

##Usage

###Launch proxy servers programmatically

```javascript
var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  auth: "user:password", //Authorization credentials. Defaults to undefined (no authorization required)
  proxy: "http://some.other.proxy:8181", //Other proxy to chain to
  maxSockets: 100 //http://nodejs.org/api/http.html#http_agent_maxsockets
  requestTimeout: 60000 //number of milliseconds to wait before aborting the request
  localAddress: "192.168.1.62" //http://nodejs.org/api/http.html#http_http_request_options_callback
  followRedirect: true //follow HTTP 3xx responses as redirects. Defaults to false (do not follow)
});

httpProxy.listen(8080, function () {
  //Listening...
  console.log(httpProxy.server.address().port); //8080
});
```

###Launch proxy servers from the command line

```
~/http-proxy$ node app.js [options]
```

The options are:

- `--auth` Authorization credentials. Defaults to undefined (no authorization required).<br/>
- `--proxy` Other proxy to chain to.<br/>
- `--maxSockets` Override Node.js' HTTPAgent `maxSockets`. Defaults to Node.js' default value _(5)_<br/>
- `--localAddress` Local interface to bind for network connections.<br/>
- `--followRedirect` Follow HTTP 3xx responses as redirects.<br/>
- `--port` Port to listen to. By default a random port will be assigned.<br/>
- `--cluster` If present, the proxy server will be clustered according to the number of available CPU cores.

##Testing

```bash
~/http-proxy$ npm install
~/http-proxy$ npm test
```
