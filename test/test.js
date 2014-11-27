var HttpProxy = require("../")
,   cachePath = __dirname + "/cache"
,   cacheTtl = 1000 * 60 * 10//10 minutes
,   sh = require("execSync")
,   nock = require("nock")
,   fs = require("fs")
,   request = require("request").defaults({
      proxy: "http://test:test@localhost:8181"
    });

describe("HttpProxy", function () {
  before(function () {
    //Silent all HttpProxy instances
    HttpProxy.prototype.log = function () {};
  });

  describe("behaviors", function () {
    before(function () {
      //Crate proxy first server
      var httpProxy = new HttpProxy({
        auth: "test:test"
      });
      httpProxy.listen(8181);

      //Crate second proxy server (this is chained with the fist one)
      var chainedProxy = new HttpProxy({
        proxy: "http://test:test@localhost:8181"
      });
      chainedProxy.listen(8282);
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
            expect(JSON.parse(body).url).to.equal("https://httpbin.org/get");
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

    describe("authorization", function () {
      it("responds with 401 (unhautorized) code for http requests", function (done) {
        request.get({uri: "http://httpbin.org/get", proxy: "http://wrong:wrong@localhost:8181"}, function (error, response, body) {
          expect(response.statusCode).to.equal(401);
          done();
        });
      });

      it("responds with 401 (unhautorized) code for https requests", function (done) {
        request.get({uri: "https://httpbin.org/get", proxy: "http://wrong:wrong@localhost:8181"}, function (error, response, body) {
          expect(error.message).to.equal("tunneling socket could not be established, statusCode=401");
          done();
        });
      });
    });

    describe("errors", function () {
      it("handles errors properly", function (done) {
        request.get("http://unexistingdomain.com/unexistingpath", function (error, response, body) {
          //502 Bad Gateway
          expect(response.statusCode).to.equal(502);
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

        nock("https://myserver.com")
          .filteringPath(/\/.+/, "/x")
          .get("/x")
          .times(this.n)
          .reply(200, this.response);

        nock.disableNetConnect();
        nock.enableNetConnect("localhost");
      });

      function testCaseForConcurrency (protocol, response, numRequests, done) {
        var completed = 0;

        for (var i = 0; i < numRequests; i++) {
          request.get(protocol + "://myserver.com/" + i, function (error, res, body) {
            expect(body).to.equal(response);
            if (++completed == numRequests) {
              done();
            };
          });
        };
      };

      it("Handles concurrency of http requests", function (done) {
        testCaseForConcurrency("http", this.response, this.n, done);
      });

      it("Handles concurrency of https requests", function (done) {
        testCaseForConcurrency("https", this.response, this.n, done);
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

        nock("https://myserver2.com")
          .filteringPath(/\/.+/, "/x")
          .get("/x")
          .times(this.n)
          .reply(200, this.response);

        nock.disableNetConnect();
        nock.enableNetConnect("localhost");
      });

      function testCaseForAborting (protocol, response, numRequests, done) {
        var completed = 0;

        for (var i = 0; i < numRequests; i++) {
          var req = request.get(protocol + "://myserver2.com/" + i, function (error, res, body) {
            expect(body).to.equal(response);
            if (++completed == numRequests / 2) {
              done();
            };
          });
          //Abort 50% of requests
          if (!(i % 2)) {
            req.abort();
          };
        };
      }

      it("Handles http aborted requests", function (done) {
        testCaseForAborting("http", this.response, this.n, done);
      });

      it("Handles https aborted requests", function (done) {
        testCaseForAborting("http", this.response, this.n, done);
      });
    });
  });
});