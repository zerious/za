var http = require('http')
var parse = require('./parse')

var proto = http.IncomingMessage.prototype

proto.header = function (name) {
  return this.headers[(name || '').toLowerCase()]
}

if (!proto.hasOwnProperty('cookies')) {
  Object.defineProperty(proto, 'cookies', {
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

if (!proto.hasOwnProperty('query')) {
  Object.defineProperty(proto, 'query', {
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

if (!proto.hasOwnProperty('body')) {
  Object.defineProperty(proto, 'body', {
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
