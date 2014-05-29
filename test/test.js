var HttpProxy = require("../")
,   cachePath = __dirname + "/cache"
,   cacheTtl = 1000 * 60 * 10 //10 minutes
,   sh = require("execSync")
,   request = require("request").defaults({
      proxy: "http://localhost:8080",
      tunnel: false
    });

describe("HttpProxy", function () {
  before(function () {
    //Crate proxy server
    var httpProxy = new HttpProxy({
      cache: {
        enable: true,
        path: cachePath,
        ttl: cacheTtl
      }
    });
    httpProxy.listen(8080);
  });

  describe("proxying", function () {
    beforeEach(function () {
      sh.run("rm -rf " + cachePath);
    });

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

      it("proxies PUT requests properly", function (done) {
        request.post({uri: "http://httpbin.org/post", body: "Some random PUT data"}, function (error, response, body) {
          expect(JSON.parse(body).data).to.equal("Some random PUT data");
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

      it("proxies PUT requests properly", function (done) {
        request.post({uri: "https://httpbin.org/post", body: "Some random safe PUT data"}, function (error, response, body) {
          expect(JSON.parse(body).data).to.equal("Some random safe PUT data");
          done();
        });
      });
    });
  });
});