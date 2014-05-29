/*

Usage:

var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({cache: {
  enable: true,
  path: "/path/to/cache/dir"
}});

httpProxy.listen(8080);
*/

module.exports = HttpProxy;

var http = require("http")
,   https = require("https");

function HttpProxy (options) {
  var self = this;
  this.cache = options.cache || {};

  this.server = http.createServer(function (req, res) {
    var protocol = req.url.indexOf("https") == 0 ? https : http
    ,   host = req.headers.host.split(":")
    ,   options
    ,   proxy;

    options = {
      hostname: host[0],
      port: protocol == https ? 443 : host[1] || 80,
      method: req.method || "GET",
      path: req.url.substring(req.url.indexOf(host[0]) + host[0].length, req.url.length),
      headers: req.headers
    };

    proxy = protocol.request(options, function (response) {
      response.pipe(res);
    });

    req.pipe(proxy);
  });
};

HttpProxy.prototype.listen = function (port) {
  this.server.listen(port);
};