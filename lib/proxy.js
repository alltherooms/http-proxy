/*
Usage:

var HttpProxy = require("http-proxy");

httpProxy = new HttpProxy({
  cache: {
    enabled: true,
    path: "/path/to/cache/dir",
    ttl: 60000
  },
  auth: "user:password",
  proxy: "http://some.other.proxy:8080"
});

httpProxy.listen(8080);
*/

module.exports = HttpProxy;

var fs = require("graceful-fs")
,   async = require("async")
,   http = require("http")
,   request = require("request")
,   RequestBuffer = require("./request-buffer")
,   ResponseBuffer = require("./response-buffer");

function HttpProxy (options) {
  var self = this;
  this.cache = options.cache || {ttl: 60000};
  this.auth = options.auth;
  this.proxy = options.proxy;

  if (this.cache.enabled){
    if (!this.cache.path) {
      throw new Error("options.cahe.path must be specified");
    };
    //TTL check interval
    setInterval(function () {
      self.cleanUp();
    }, this.cache.ttl / 2);
    this.cleanUp();
  };

  this.server = http.createServer(function (req, res) {
    self.handleRequest(req, res);
  });
};


HttpProxy.prototype.isFileStale = function (file, callback) {
  var self = this;
  fs.stat(file, function (error, stats) {
    if (error) return callback(error);
    callback(null, new Date().getTime() - stats.mtime.getTime() >= self.cache.ttl);
  });
};

HttpProxy.prototype.cleanUp = function () {
  var self = this;
  fs.readdir(this.cache.path, function (error, files) {
    if (error) return console.log(error.stack);
    async.eachSeries(files, function (file, callback) {
      self.isFileStale(self.cache.path + "/" + file, function (error, isStale) {
        if (error) console.log(error.stack);
        if (isStale) {
          fs.unlink(self.cache.path + "/" + file, function (error) {
            if (error) console.log(error.stack);
            callback();
          });
        } else {
          callback();
        };
      });
    });
  });
};

HttpProxy.prototype._getHashCode = function (string) {
  var hash = 0, i, chr, len;
  if (string.length == 0) return hash;
  for (i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0;
  };
  return hash;
};

HttpProxy.prototype.handleRequest = function (req, res) {
  var self = this, options;

  if (this.auth) {
    if (!req.headers["proxy-authorization"] || (new Buffer(req.headers["proxy-authorization"].split(" ")[1], "base64")).toString() != this.auth) {
      res.statusCode = 401;
      return res.end();
    };
    delete req.headers["proxy-authorization"];
  };

  options = {
    method: req.method || "GET",
    headers: req.headers,
    uri: req.url
  };

  if (this.proxy) {
    options.proxy = this.proxy;
    options.tunnel = false;
  };

  if (!this.cache.enabled) {
    return this.proxyRequest(options, req, res);
  };

  var respondFromCache = function (filePath) {
    res.statusCode = 200;
    //Get cached headers
    var headers = "";
    fs.createReadStream(filePath + "_headers.json")
      .on("error", function (error) {
        console.log(error.stack);
      }).on("data", function (chunk) {
        headers += chunk;
      }).on("end", function () {
        //Set cached headers to response
        headers = JSON.parse(headers);
        Object.keys(headers).forEach(function (key) {
          res.setHeader(key, headers[key]);
        });
        fs.createReadStream(filePath).pipe(res);
      });
  };

  var filePath
  ,   key
  ,   requestOptions = {
        method: options.method,
        uri: options.uri,
        headers: options.headers
      };

  if (options.method == "POST" || options.method == "PUT") {
    var requestBuffer = new RequestBuffer();
    req.pipe(requestBuffer).once("finish", function () {
      key = self._getHashCode(JSON.stringify(requestOptions) + requestBuffer.buffer.join(""));
      filePath = self.cache.path + "/" + key;
      fs.exists(filePath, function (exists) {
        if (!exists) {
          self.proxyRequest(options, requestBuffer, res, filePath);
        } else {
          self.isFileStale(filePath, function (error, isStale) {
            if (isStale) {
              fs.unlink(filePath, function (error) {
                self.proxyRequest(options, requestBuffer, res, filePath);
              });
            } else {
              respondFromCache(filePath);
            };
          });
        };
      });
    });

  } else {
    key = this._getHashCode(JSON.stringify(requestOptions));
    filePath = self.cache.path + "/" + key;
    fs.exists(filePath, function (exists) {
      if (!exists) {
        self.proxyRequest(options, req, res, filePath);
      } else {
        self.isFileStale(filePath, function (error, isStale) {
          if (isStale) {
            fs.unlink(filePath, function (error) {
              self.proxyRequest(options, req, res, filePath);
            });
          } else {
            respondFromCache(filePath);
          };
        });
      };
    });
  };
};

HttpProxy.prototype.proxyRequest = function (options, req, res, filePath) {
  var proxyRequest = request(options);
  proxyRequest.on("response", function (response) {
    // Copy headers from http response to proxy response
    Object.keys(response.headers).forEach(function (key) {
      res.setHeader(key, response.headers[key]);
    });
    // Set statusCode of http response to proxy response
    res.statusCode = response.statusCode;

    if (!filePath) return response.pipe(res);

    //Only cache 2xx responses
    if (response.statusCode >= 200 && response.statusCode <= 300) {
      var responseBuffer = new ResponseBuffer(filePath);
      response.pipe(responseBuffer).pipe(res);
      //Cache headers
      fs.createWriteStream(filePath + "_headers.json").write(JSON.stringify(response.headers));
    } else {
      response.pipe(res);
    };
  });
  proxyRequest.on("error", function (error) {
    res.statusCode = 500;
    res.end(error.stack);
  });
  req.pipe(proxyRequest);
};

HttpProxy.prototype.listen = function (port) {
  this.server.listen(port);
};