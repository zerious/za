var http = require('http')
var escape = require('querystring').escape
// TODO: Benchmark zlib performance against node-compress.
var zlib = require('zlib')

var proto = http.ServerResponse.prototype

proto.json = function (object) {
  var json = JSON.stringify(object)
  var self = this
  self.setHeader('content-type', 'application/json')
  self.zip(json)
}

proto.send = function (data) {
  var self = this
  var type = typeof data
  if (type !== 'string') {
    data = JSON.stringify(data)
    self.setHeader('content-type', 'application/json')
  }
  self.zip(data)
}

proto.zip = function (text, preZipped) {
  // TODO: Determine whether 1e3 is the right threshold.
  var self = this
  if (preZipped || (text.length > 1e3)) {
    var req = self.request
    if (req && /\bgzip\b/.test(req.headers['accept-encoding'])) {
      if (preZipped) {
        self.setHeader('content-encoding', 'gzip')
        self.end(preZipped)
      } else {
        zlib.gzip(text, function (err, zipped) {
          if (err) {
            console.log(err)
            self.end(text)
          } else {
            self.setHeader('content-encoding', 'gzip')
            self.end(zipped)
          }
        })
      }
      return
    }
  }
  self.end(text)
}

proto.cookie = function (name, value, options) {
  var self = this
  self.setHeader('set-cookie', name + '=' + escape(value))
}

proto.redirect =
proto.redirect || function (location) {
  var self = this
  self.statusCode = 302
  self.setHeader('location', location)
  self.end()
}
