var multipart = require('./multipart')
var doNothing = function () {}

// Maximum number of bytes we can receive (to avoid storage attacks).
var MAX_BYTES = 1e8; // ~100MB.

/**
 * Turn a string into a RegExp pattern if it has asterisks.
 */
function patternify (str, start, end) {
  if (typeof str === 'string') {
    str = str.toLowerCase()
    if (str.indexOf('*') > -1) {
      str = str.replace(/\*/g, '@')
      str = str.replace(/([^\d\w_-])/gi, '\\$1')
      str = str.replace(/\\@/g, '.*')
      return new RegExp(start + str + end, 'i')
    }
  }
  return str
}

/**
 * A Lighter Router sets up HTTP routing.
 */
var Router = module.exports = function Router (protocol) {
  var self = this
  self.protocol = protocol

  // Paths are keys/items on/in the routes array.
  var routes = self.routes = {}

  // Middlewares are functions that chain asynchronously.
  var middlewares = self.middlewares = []

  /**
   * Process a request and write to the response.
   */
  self.serve = function (request, response) {
    response.request = request
    var app = response.app = self.app

    var url = request.url
    if (url.indexOf('?') > -1) {
      var parts = url.split('?')
      url = parts[0]
      request.queryString = parts[1]
    }
    url = url.toLowerCase()

    var m = middlewares
    var i = 0

    /**
     * Iterate over middlewares that return truthy values.
     * Wait for falsy-returning middlewares to call `next`.
     */
    function next () {
      var ok, fn
      do {
        fn = m[i++]
        if (fn) {
          ok = fn.call(app, request, response, next)
        } else {
          return finish()
        }
      } while (ok)
    }

    /**
     * Finish the request.
     */
    function finish () {
      var method = request.method

      // TODO: Add automagic support for CONNECT/OPTIONS/TRACE?
      if (method === 'HEAD') {
        method = 'GET'
        response.write = doNothing
      }
      var map = routes[method] || routes.GET
      var fn = map[url]

      // If the path didn't map to a route, iterate over wildcard routes.
      if (!fn) {
        for (var i = 0, l = map.length; i < l; i++) {
          var p = map[i]
          if (p.test(url)) {
            fn = map['@' + p]
            break
          }
        }
      }

      if (fn) {
        var that = fn.self || self
        if (method[0] === 'P') {
          var maxBytes = fn._MAX_BYTES || MAX_BYTES
          if (/multipart/.test(request.headers['content-type'])) {
            request.multipart = {}
            fn.call(that, request, response)
            multipart(request, response, maxBytes)
          } else {
            var buffer
            buffer = ''
            request.on('data', function (data) {
              buffer += data
              if (buffer.length > maxBytes) {
                request.connection.destroy()
              }
            })
            request.on('end', function () {
              request.buffer = buffer
              fn.call(that, request, response)
            })
          }
        } else {
          fn.call(that, request, response)
        }
      } else if (response.error) {
        response.error(404)
      } else {
        response.statusCode = 404
        response.setHeader('content-type', 'text/html')
        response.end('<h1>Page Not Found</h1>')
      }
    }

    next()
  }
}

Router.prototype = {

  /**
   * Add a function to handle a specific HTTP method and URL path.
   */
  add: function (method, path, fn) {
    var self = this
    var routes = self.routes
    method = method.toUpperCase()
    path = patternify(path, '^', '$')
    var map = routes[method] = routes[method] || []

    // Map a pattern with "@", and add to the list of patterns.
    if (path instanceof RegExp) {
      map.push(path)
      map['@' + path] = fn

    // Or map a path directly.
    } else {
      map[path] = fn
    }
  },

  /**
   * Add a middleware, with an optional path.
   */
  use: function (path, fn) {
    var self = this
    var app = self.app
    var middleware
    if (typeof path === 'function') {
      middleware = path
    } else {
      path = patternify(path, '^', '')
      if (path instanceof RegExp) {
        middleware = function (request) {
          var isMatch = path.test(request.url)
          return isMatch ? fn.apply(app, arguments) : true
        }
      } else {
        middleware = function (request) {
          var isMatch = (request.url.indexOf(path) === 0)
          return isMatch ? fn.apply(app, arguments) : true
        }
      }
      middleware.fn = fn
    }
    self.middlewares.push(middleware)
  },

  /**
   * Remove a middleware, regardless of path.
   */
  unuse: function (fn) {
    var self = this
    var middlewares = self.middlewares
    for (var i = 0; i < middlewares.length; i++) {
      var middleware = middlewares[i]
      if ((fn === middleware) || (fn === middleware.fn)) {
        middlewares.splice(i--, 1)
      }
    }
  }
}
