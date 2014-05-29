var HttpProxy = require("../")
,   cachePath = __dirname + "/cache"
,   cacheTtl = 1000 * 30 //10 minutes
,   sh = require("execSync")
,   nock = require("nock")
,   request = require("request").defaults({
      proxy: "http://test:test@localhost:8080",
      tunnel: false
    });

describe("HttpProxy", function () {
  before(function () {
    //Remove cache directory
    sh.run("rm -rf " + cachePath);

    //Create cache directory
    sh.run("mkdir " + cachePath);

    //Crate proxy server
    var httpProxy = new HttpProxy({
      cache: {
        enabled: true,
        path: cachePath,
        ttl: cacheTtl
      },
      auth: "test:test"
    });

    httpProxy.listen(8080);
  });

  describe("proxying", function () {
    describe("http", function () {
      it("proxies GET requests properly", function (done) {
        request.get("http://httpbin.org/get", function (error, response, body) {
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("proxies POST requests properly", function (done) {
        request.post({uri: "http://httpbin.org/post", body: "Some random POST data"}, function (error, response, body) {
          expect(JSON.parse(body).data).to.equal("Some random POST data");
          done();
        });
      });
    });

    describe("https", function () {
      it("proxies GET requests properly", function (done) {
        request.get("https://httpbin.org/get", function (error, response, body) {
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("proxies POST requests properly", function (done) {
        request.post({uri: "https://httpbin.org/post", body: "Some random safe POST data"}, function (error, response, body) {
          expect(JSON.parse(body).data).to.equal("Some random safe POST data");
          done();
        });
      });
    });
  });

  describe("caching", function () {
    before(function () {
      nock.disableNetConnect();
      nock.enableNetConnect("localhost"); //Enable http request to proxy only
    });

    it("responds the GET request from the cache", function (done) {
      request.get("http://httpbin.org/get", function (error, response, body) {
        expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
        done();
      });
    });

    it("responds the POST request from the cache", function (done) {
      request.post({uri: "http://httpbin.org/post", body: "Some random POST data"}, function (error, response, body) {
        expect(JSON.parse(body).data).to.equal("Some random POST data");
        done();
      });
    });
  });

  after(function () {
    //Remove cache directory
    sh.run("rm -rf " + cachePath);
  });
});