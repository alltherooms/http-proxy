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
var i = 0;
module.exports = HttpProxy;

var fs = require("graceful-fs")
,   async = require("async")
,   http = require("http")
,   request = require("request")
,   CronJob = require("cron").CronJob
,   RequestBuffer = require("./request-buffer")
,   ResponseBuffer = require("./response-buffer");

function HttpProxy (options) {
  var self = this
  ,   cronJob;

  this.cache = options.cache || {ttl: 60000};
  this.auth = options.auth;
  this.proxy = options.proxy;
  this.request = request.defaults({
    pool: {
      maxSockets: options.maxSockets || Infinity
    }
  });

  if (this.cache.enabled){
    if (!this.cache.path) {
      throw new Error("options.cahe.path must be specified");
    };
    //Cache clean up cron-job
    cronJob = new CronJob({
      cronTime: "00 00 08 * * *", //runs every day at 8AM UTC
      timeZone: "UTC",
      onTick: function () {
        self.cleanUp();
      }
    });
    cronJob.start();
  };

  this.server = http.createServer(function (req, res) {
    self.handleRequest(req, res);
  });
};

HttpProxy.prototype.log = function () {
  console.log.apply(this, arguments);
};

HttpProxy.prototype.isFileStale = function (file, callback) {
  var self = this;
  fs.stat(file, function (error, stats) {
    if (error) return callback(error);
    callback(null, new Date().getTime() - stats.mtime.getTime() >= self.cache.ttl);
  });
};

HttpProxy.prototype.cleanUp = function (callback) {
  var self = this;
  console.log("Running cleanUp");
  fs.readdir(this.cache.path, function (error, files) {
    if (error) return console.error(error.stack);
    async.eachSeries(files, function (file, callback) {
      self.isFileStale(self.cache.path + "/" + file, function (error, isStale) {
        if (error) console.error(error.stack);
        if (isStale) {
          fs.unlink(self.cache.path + "/" + file, function (error) {
            if (error) console.error(error.stack);
            callback();
          });
        } else {
          callback();
        };
      });
    }, callback);
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
  var self = this
  ,   options = {};

  if (this.auth) {
    if (!req.headers["proxy-authorization"] || (new Buffer(req.headers["proxy-authorization"].split(" ")[1], "base64")).toString() != this.auth) {
      res.statusCode = 401;
      return res.end();
    };
    delete req.headers["proxy-authorization"];
  };

  if (req.headers["proxy-timeout"]) {
    if (this.proxy) return;
    options.timeout = parseInt(req.headers["proxy-timeout"]);
    if (isNaN(options.timeout)) delete options.timeout;
    delete req.headers["proxy-timeout"];
  };

  options.method = req.method || "GET";
  options.headers = req.headers;
  options.uri = req.url;

  if (this.proxy) {
    options.proxy = this.proxy;
    options.tunnel = false;
  };

  if (!this.cache.enabled) {
    return this.proxyRequest(options, req, res);
  };

  var respondFromCache = function (filePath, _req) {
    self.log("Cache hit for %s", req.url);
    res.statusCode = 200;
    //Get cached headers
    var headers = "";
    fs.createReadStream(filePath + "_headers.json")
      .on("error", function (error) {
        console.error(error.stack);
        this.proxyRequest(options, _req, res);
      }).on("data", function (chunk) {
        headers += chunk;
      }).on("end", function () {
        try {
          //Set cached headers to response
          headers = JSON.parse(headers);
        } catch (e) {
          console.error(e.stack);
          return self.proxyRequest(options, _req, res);
        };
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
            if (error) {
              console.error(error.stack);
              return self.proxyRequest(options, requestBuffer, res, filePath);
            };

            if (isStale) {
              fs.unlink(filePath, function (error) {
                self.proxyRequest(options, requestBuffer, res, filePath);
              });
            } else {
              respondFromCache(filePath, requestBuffer);
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
          if (error) {
            console.error(error.stack);
            return self.proxyRequest(options, req, res, filePath);
          };

          if (isStale) {
            fs.unlink(filePath, function (error) {
              self.proxyRequest(options, req, res, filePath);
            });
          } else {
            respondFromCache(filePath, req);
          };
        });
      };
    });
  };
};

HttpProxy.prototype.proxyRequest = function (options, req, res, filePath) {
  var proxyRequest = this.request(options);
  proxyRequest.on("response", function (response) {
    // Copy headers from http response to proxy response
    Object.keys(response.headers).forEach(function (key) {
      res.setHeader(key, response.headers[key]);
    });
    // Set statusCode of http response to proxy response
    res.statusCode = response.statusCode;

    if (!filePath) return response.pipe(res);

    //Only cache < 5xx responses
    if (response.statusCode < 500) {
      var responseBuffer = new ResponseBuffer(filePath);
      response.pipe(responseBuffer).pipe(res);
      //Cache headers
      var headersFile = fs.createWriteStream(filePath + "_headers.json");
      headersFile.end(JSON.stringify(response.headers));
    } else {
      response.pipe(res);
    };
  });
  proxyRequest.on("error", function (error) {
    if (error.code == "ETIMEDOUT") {
      res.statusCode = 504;
      res.end();
    } else {
      res.statusCode = 500;
      res.end(error.stack);
    };
  });
  req.pipe(proxyRequest);
};

HttpProxy.prototype.listen = function (port) {
  this.server.listen(port);
};