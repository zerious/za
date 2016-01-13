var http = require('http')
var escape = require('querystring').escape
// TODO: Benchmark zlib performance against node-compress.
var zlib = require('zlib')

var res = http.ServerResponse.prototype

res.json = function json (object) {
  var json = JSON.stringify(object)
  this.setHeader('content-type', 'application/json')
  this.zip(json)
}

res.send = function send (data) {
  var type = typeof data
  if (type !== 'string') {
    data = JSON.stringify(data)
    this.setHeader('content-type', 'application/json')
  }
  this.zip(data)
}

res.zip = function zip (text, preZipped) {
  // TODO: Determine whether 1e3 is the right threshold.
  if (preZipped || ((text || 0).length > 1e3)) {
    var req = this.request
    // TODO: Make CORS optional?
    this.setHeader('access-control-allow-origin', '*')
    if (req && /\bgzip\b/.test(req.headers['accept-encoding'])) {
      if (preZipped) {
        this.setHeader('content-encoding', 'gzip')
        this.end(preZipped)
      } else {
        zlib.gzip(text, function (err, zipped) {
          if (err) {
            console.log(err)
            this.end(text)
          } else {
            this.setHeader('content-encoding', 'gzip')
            this.end(zipped)
          }
        })
      }
      return
    }
  }
  this.end(text)
  return this
}

res.cookie = function (name, value, options) {
  if (typeof value === 'object') {
    value = JSON.stringify(value)
  }
  options.path = options.path || '/'
  var cookie = name + '=' + escape(value)
  for (var key in options) {
    value = options[key]
    if (key === 'maxAge') {
      key = 'expires'
      value = new Date(Date.now() + value)
    }
    if (key === 'expires') {
      value = value.toGMTString()
    }
    cookie += ';' + key + '=' + value
  }
  this.setHeader('set-cookie', cookie)
  return this
}

res.clearCookie = function clearCookie (name, options) {
  options = options || {}
  options.expires = new Date(1)
  return this.cookie(name, 0, options)
}

res.redirect =
res.redirect || function (location) {
  this.statusCode = 302
  this.setHeader('location', location)
  this.end()
}
