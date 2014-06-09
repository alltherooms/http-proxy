module.exports = ResponseBuffer;

var fs = require("fs")
,   stream = require("stream")
,   util = require("util");

util.inherits(ResponseBuffer, stream.Transform);

function ResponseBuffer (filePath) {
  stream.Transform.call(this);

  this.writeStream = fs.createWriteStream(filePath);
  this.on("finish", function () {
    //Finished writing, end the writeStream (this closes the file descriptor)
    this.writeStream.end();
  });
};

ResponseBuffer.prototype._transform = function (chunk, encoding, callback) {
  this.writeStream.write(chunk.toString());
  this.push(chunk);
  callback();
};