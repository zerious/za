var http = require('http')
var parse = require('./parse')

var req = http.IncomingMessage.prototype

req.header = function header (name) {
  return this.headers[(name || '').toLowerCase()]
}

if (!req.hasOwnProperty('cookies')) {
  Object.defineProperty(req, 'cookies', {
    enumerable: false,
    get: function () {
      var cookies = this._cookies
      if (!cookies) {
        cookies = {}
        var cookie = this.headers.cookie
        if (cookie) {
          cookie.split(/; ?/).forEach(function (pair) {
            pair = pair.split('=')
            cookies[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1])
          })
        }
        this._cookies = cookies
      }
      return cookies
    },
    set: function (value) {
      this._cookies = value
    }
  })
}

if (!req.hasOwnProperty('query')) {
  Object.defineProperty(req, 'query', {
    enumerable: false,
    get: function () {
      var query = this._query
      if (!query) {
        query = parse(this.queryString)
        this._query = query
      }
      return query
    },
    set: function (value) {
      this._query = value
    }
  })
}

if (!req.hasOwnProperty('body')) {
  Object.defineProperty(req, 'body', {
    enumerable: false,
    get: function () {
      var body = this._body
      if (!body) {
        body = this.multipart || parse(this.buffer)
        this._body = body
      }
      return body
    },
    set: function (value) {
      this._body = value
    }
  })
}
