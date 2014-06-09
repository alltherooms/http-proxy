var HttpProxy = require("../")
,   cachePath = __dirname + "/cache"
,   cacheTtl = 1000 * 60 * 10//10 minutes
,   sh = require("execSync")
,   nock = require("nock")
,   request = require("request").defaults({
      proxy: "http://test:test@localhost:8181",
      tunnel: false
    });

describe("HttpProxy", function () {
  before(function () {
    //Remove cache directory
    sh.run("rm -rf " + cachePath);

    //Create cache directory
    sh.run("mkdir " + cachePath);

    //Crate proxy first server
    var httpProxy = new HttpProxy({
      cache: {
        enabled: true,
        path: cachePath,
        ttl: cacheTtl
      },
      auth: "test:test"
    });
    httpProxy.listen(8181);

    //Crate second proxy server (this is chained with the fist one)
    var httpProxy2 = new HttpProxy({
      proxy: "http://test:test@localhost:8181"
    });
    httpProxy2.listen(8282);
  });

  describe("proxying", function () {
    describe("http", function () {
      it("proxies GET requests properly", function (done) {
        request.get("http://httpbin.org/get", function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("proxies POST requests properly", function (done) {
        request.post({uri: "http://httpbin.org/post", body: "Some random POST data"}, function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).data).to.equal("Some random POST data");
          done();
        });
      });
    });

    describe("https", function () {
      it("proxies GET requests properly", function (done) {
        request.get("https://httpbin.org/get", function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("proxies POST requests properly", function (done) {
        request.post({uri: "https://httpbin.org/post", body: "Some random safe POST data"}, function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).data).to.equal("Some random safe POST data");
          done();
        });
      });
    });
  });

  describe("Caching and chaining", function () {
    before(function () {
      nock.disableNetConnect();
      nock.enableNetConnect("localhost"); //Enable http request to proxy only
    });

    describe("Caching", function () {
      it("responds the GET request from the cache", function (done) {
        request.get("http://httpbin.org/get", function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("responds the POST request from the cache", function (done) {
        request.post({uri: "http://httpbin.org/post", body: "Some random POST data"}, function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).data).to.equal("Some random POST data");
          done();
        });
      });
    });


    describe("Chaining", function () {
      it("proxies GET requests all the way through the chain", function (done) {
        request.get({uri: "http://httpbin.org/get", proxy: "http://localhost:8282"}, function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).url).to.equal("http://httpbin.org/get");
          done();
        });
      });

      it("proxies POST requests all the way through the chain", function (done) {
        request.post({uri: "https://httpbin.org/post", body: "Some random safe POST data", proxy: "http://localhost:8282"}, function (error, response, body) {
          expect(response.headers["content-type"]).to.equal("application/json");
          expect(JSON.parse(body).data).to.equal("Some random safe POST data");
          done();
        });
      });
    });

    after(function () {
      nock.enableNetConnect();
    });
  });

  describe("authorization", function () {
    it("responds with 401 (unhautorized) code", function (done) {
      request.get({uri: "http://httpbin.org/get", proxy: "http://wrong:wrong@localhost:8181"}, function (error, response, body) {
        expect(response.statusCode).to.equal(401);
        done();
      });
    });
  });

  describe("errors", function () {
    it("handles errors properly", function (done) {
      request.get("http://unexistingdomain.com/unexistingpath", function (error, response, body) {
        expect(response.statusCode).to.equal(500);
        done();
      })
    })
  });

  describe("Concurrency", function () {
    before(function () {
      this.response = "";
      this.n = 1000;

      for (var i = 0; i < 1000; i++) {
        this.response += "abcdefgklmopqrstuvwxyz|";
      };

      nock("http://myserver.com")
        .filteringPath(/\/.+/, "/x")
        .get("/x")
        .times(this.n)
        .reply(200, this.response);

      nock.disableNetConnect();
      nock.enableNetConnect("localhost");
    });

    it("Handles concurrency of new requests", function (done) {
      var self = this
      ,   completed = 0;

      for (var i = 0; i < this.n; i++) {
        request.get("http://myserver.com/" + i, function (error, response, body) {
          expect(body).to.equal(self.response);
          if (++completed == self.n) {
            done();
          };
        });
      };
    });

    it("Handles concurrency of cached requests", function (done) {
      var self = this
      ,   completed = 0;

      for (var i = 0; i < this.n; i++) {
        request.get("http://myserver.com/" + i, function (error, response, body) {
          expect(body).to.equal(self.response);
          if (++completed == self.n) {
            done();
          };
        });
      };
    });
  });

  describe("Aborting requests", function () {
    before(function () {
      this.response = "";
      this.n = 2000;

      for (var i = 0; i < 1000; i++) {
        this.response += "abcdefgklmopqrstuvwxyz|";
      };

      nock("http://myserver2.com")
        .filteringPath(/\/.+/, "/x")
        .get("/x")
        .times(this.n)
        .reply(200, this.response);

      nock.disableNetConnect();
      nock.enableNetConnect("localhost");
    });

    it("Handles aborted requests", function (done) {
      var self = this
      ,   completed = 0;

      for (var i = 0; i < this.n; i++) {
        var req = request.get("http://myserver2.com/" + i, function (error, response, body) {
          expect(body).to.equal(self.response);
          if (++completed == self.n / 2) {
            done();
          };
        });
        //Abort 50% of requests
        if (!(i % 2)) {
          req.abort();
        };
      };
    });
  });

  after(function () {
    //Remove cache directory
    sh.run("rm -rf " + cachePath);
  });
});