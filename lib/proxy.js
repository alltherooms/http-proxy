module.exports = HttpProxy;

var fs = require("fs")
,   http = require("http")
,   https = require("https")
,   RequestBuffer = require("./request-buffer")
,   ResponseBuffer = require("./response-buffer");

function HttpProxy (options) {
  var self = this;
  this.cache = options.cache || {ttl: 60000};

  if (this.cache.enabled){
    if (!this.cache.path) {
      throw new Error("options.cahe.pat must be specified");
    };
    //TTL check interval
    setInterval(function () {
      fs.readdir(self.cache.path, function (error, files) {
        if (error) return console.log(error.stack);
        files.forEach(function (file) {
          fs.stat(self.cache.path + "/" + file, function (error, stats) {
            if (error) return console.log(error.stack);
            if (new Date().getTime() - stats.mtime.getTime() >= self.cache.ttl) {
              fs.unlink(self.cache.path + "/" + file, function (error) {
                if (error) return console.log(error.stack);
              });
            };
          });
        });
      });
    }, this.cache.ttl / 2);
  };

  this.server = http.createServer(function (req, res) {
    self.handleRequest(req, res);
  });
};

HttpProxy.prototype._getHashCode = function (string) {
  return string.split("").reduce(function (a, b) {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a
  }, 0);
};

HttpProxy.prototype.handleRequest = function (req, res) {
  var self = this
  ,   protocol = req.url.indexOf("https") == 0 ? https : http
  ,   host = req.headers.host.split(":")
  ,   options = {
      hostname: host[0],
      port: protocol == https ? 443 : host[1] || 80,
      method: req.method || "GET",
      path: req.url.substring(req.url.indexOf(host[0]) + host[0].length, req.url.length),
      headers: req.headers
    };

  if (!this.cache.enabled) {
    return this.proxyRequest(options, req, res);
  };

  var filePath, key;

  if (options.method == "POST" || options.method == "PUT") {
    var requestBuffer = new RequestBuffer();
    req.pipe(requestBuffer).once("finish", function () {
      key = self._getHashCode(JSON.stringify(options) + requestBuffer.buffer.join(""));
      filePath = self.cache.path + "/" + key;
      fs.exists(filePath, function (exists) {
        if (!exists) {
          self.proxyRequest(protocol, options, requestBuffer, res, filePath);
        } else {
          res.statusCode = 200;
          fs.createReadStream(filePath).pipe(res);
        };
      });
    });

  } else {
    key = this._getHashCode(JSON.stringify(options));
    filePath = self.cache.path + "/" + key;
    fs.exists(filePath, function (exists) {
      if (!exists) {
        self.proxyRequest(protocol, options, req, res, filePath);
      } else {
        res.statusCode = 200;
        fs.createReadStream(filePath).pipe(res);
      };
    });
  };
};

HttpProxy.prototype.proxyRequest = function (protocol, options, req, res, filePath) {
  var proxy = protocol.request(options, function (response) {
    if (!filePath) return response.pipe(res);
    var responseBuffer = new ResponseBuffer(filePath);
    response.pipe(responseBuffer).pipe(res);
  });
  req.pipe(proxy);
};

HttpProxy.prototype.listen = function (port) {
  this.server.listen(port);
};