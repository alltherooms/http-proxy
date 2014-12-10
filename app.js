var argv = require("minimist")(process.argv)
,   cluster = require("cluster")
,   numCpus = require("os").cpus().length
,   HttpProxy = require("./")
,   options = {}
,   port = 0
,   httpProxy;

if (argv.auth) options.auth = argv.auth;
if (argv.proxy) options.proxy = argv.proxy;
if (argv.maxSockets) options.maxSockets = argv.maxSockets;
if (argv.localAddress) options.localAddress = argv.localAddress;
if (argv.followRedirect) options.followRedirect = argv.followRedirect;
if (argv.port) port = argv.port;

if (!argv.cluster) {
  httpProxy = new HttpProxy(options);
  return httpProxy.listen(port, function () {
    console.log("Proxy server listening on %s:%d", httpProxy.server.address().address, httpProxy.server.address().port);
  });
};

if (cluster.isMaster) {
  for (var i = 0; i < numCpus; i++) {
    cluster.fork();
  };
  cluster.on("exit", function(worker, code, signal) {
    console.log("worked with PID %d died with code %d and signal %s. Restarting...", worker.process.pid, code, signal);
    cluster.fork();
  });
} else {
  httpProxy = new HttpProxy(options);
  httpProxy.listen(port, function () {
    console.log("Proxy server listening on %s:%d", httpProxy.server.address().address, httpProxy.server.address().port);
  });
};