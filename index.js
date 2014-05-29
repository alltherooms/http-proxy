/*

Usage:

var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({cache: {
  enabled: true,
  path: "/path/to/cache/dir",
  ttl: 60000
}});

httpProxy.listen(8080);
*/

module.exports = require("./lib/proxy");