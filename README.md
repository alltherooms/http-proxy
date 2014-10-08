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
});

httpProxy.listen(8080, function () {
  //Listening...
});
```

###Launch proxy servers from the command line

```
~/http-proxy$ node app.js [options]
```

The options are:

- `--proxy` Other proxy to chain to.<br/>
- `--maxSockets` Override Node.js' HTTPAgent `maxSockets`. Defaults to Node.js' default value _(5)_<br/>
- `--port` Port to listen to. By default a random port will be assigned.<br/>
- `--auth` Authorization credentials. Defaults to undefined (no authorization required).<br/>
- `--cluster` If present, the proxy server will be clustered according to the number of available CPU cores.

##Testing

```bash
~/http-proxy$ npm install
~/http-proxy$ npm test
```
