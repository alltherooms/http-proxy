module.exports = ResponseBuffer;

var fs = require("fs")
,   stream = require("stream")
,   util = require("util");

util.inherits(ResponseBuffer, stream.Transform);

function ResponseBuffer (filePath) {
  this.writeStream = fs.createWriteStream(filePath);
  stream.Transform.call(this);
};

ResponseBuffer.prototype._transform = function (chunk, encoding, callback) {
  this.writeStream.write(chunk.toString());
  this.push(chunk);
  callback();
};