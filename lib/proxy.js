/*
Usage:

var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  auth: "user:password",
  proxy: "http://some.other.proxy:8080"
  maxSockets: 50,
  timeout: 120000,
  localAddress: "192.168.1.62",
  followRedirect: true
});

httpProxy.listen(8080);
*/

module.exports = HttpProxy;

var http = require("http")
,   request = require("request")
,   url = require("url")
,   net = require("net");

function HttpProxy (options) {
  var requestDefaults = {
    followRedirect: false,
    maxSockets: 50
  };

  options = options || {};

  this.auth = options.auth;
  this.proxy = options.proxy;
  this.timeout = options.timeout;

  if (options.maxSockets) {
    requestDefaults.pool = {
      maxSockets: options.maxSockets
    };
  }

  if (options.localAddress) {
    requestDefaults.localAddress = options.localAddress;
  }

  if (options.followRedirect) {
    requestDefaults.followRedirect = options.followRedirect;
  }

  this.request = request.defaults(requestDefaults);

  this.server = http.createServer((req, res) => {
    this.proxyRequest(req, res);
  });

  //Support for HTTP Tunneling: http://en.wikipedia.org/wiki/HTTP_tunnel
  this.server.on("connect", (req, clientSocket, head) => {
    thiself.tunelRequest(req, clientSocket, head);
  });
};

HttpProxy.prototype.log = function () {
  console.log.apply(this, arguments);
};

HttpProxy.prototype.isAuthorized = function (req) {
  if (!this.auth) return true;

  var proxyAth = req.headers["proxy-authorization"] || req.headers["Proxy-Authorization"];

  if (!proxyAth) return false;

  delete req.headers["proxy-authorization"];
  delete req.headers["Proxy-Authorization"];

  return (new Buffer(proxyAth.split(" ")[1], "base64")).toString() == this.auth;
};

HttpProxy.prototype.proxyRequest = function (req, res) {
  var self = this
  ,   options
  ,   _req;

  if (!this.isAuthorized(req)) {
    res.statusCode = 401;
    return res.end("Node-Http-Proxy: Not Authorized");
  }

  options = {
    method: req.method || "GET",
    headers: req.headers,
    uri: req.url
  };

  if (this.proxy) {
    options.proxy = this.proxy;
  }

  if (this.timeout) {
    options.timeout = this.timeout;
  }

  _req = this.request(options);

  _req.on("error", function (error) {
    if (error.code == "ETIMEDOUT") {
      //504 Gateway Timeout
      res.statusCode = 504;
      res.end();
    }
    /*502 Bad Gateway
    The server, while acting as a gateway or proxy, received an invalid response
    from the upstream server it accessed in attempting to fulfill the request.*/
    res.statusCode = 502;
    res.end(error.stack);
  });

  _req.on("response", function (response) {
    //Set `response` headers and statusCode to `res`
    var keys = Object.keys(response.headers);
    for (var i = keys.length - 1; i >= 0; i--) {
      res.setHeader(keys[i], response.headers[keys[i]]);
    };
    res.statusCode = response.statusCode;
  });

  req.pipe(_req).pipe(res);
};

HttpProxy.prototype.tunelRequest = function (req, clientSocket, head) {
  if (!this.isAuthorized(req)) {
    return clientSocket.end("HTTP/1.1 401 Unauthorized\r\nProxy-agent: Node-Http-Proxy\r\n\r\n");
  }

  var upstream = url.parse("http://" + req.url)
  ,   serverSocket;

  serverSocket = net.connect({host: upstream.hostname, port: upstream.port}, function () {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\nProxy-agent: Node-Http-Proxy\r\n\r\n");
    serverSocket.write(head);
    clientSocket.pipe(serverSocket).pipe(clientSocket);
  });

  serverSocket.on("error", function (error) {
    //502 Bad Gateway
    clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n" + error.stack + "\r\nProxy-agent: Node-Http-Proxy\r\n\r\n");
  });

  if (this.timeout) {
    serverSocket.setTimeout(this.timeout, function () {
      //504 Gateway Timeout
      clientSocket.end("HTTP/1.1 504 Gateway Timeout\r\nProxy-agent: Node-Http-Proxy\r\n\r\n");
    });
  }
};

HttpProxy.prototype.listen = function () {
  return this.server.listen.apply(this.server, arguments);
};