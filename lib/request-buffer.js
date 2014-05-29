module.exports = RequestBuffer;

var stream = require("stream")
,   util = require("util");

util.inherits(RequestBuffer, stream.Duplex);

function RequestBuffer () {
  stream.Duplex.call(this);
  this.buffer = [];
};

RequestBuffer.prototype._write = function (chunk, encoding, callback) {
  this.buffer.push(chunk);
  callback();
};

RequestBuffer.prototype._read = function (size) {
  var chunk;
  if (chunk = this.buffer.shift()) {
    this.push(chunk);
  } else {
    this.push(null);
  };
};