var dir = __dirname;
var fs = require('fs');
var Router = require(dir + '/lib/_router');
var parse = require(dir + '/lib/parse');
var Type = require(dir + '/common/object/type');
var defaultPort = 8888;

// Decorate Request and Response prototypes.
require(dir + '/lib/_request');
require(dir + '/lib/_response');

// Za is a Server factory function.
var za = module.exports = function (options) {
  return new Server(options);
};

/**
 * A Za Server is a fast, simple HTTP server.
 */
var Server = za.Server = Type.extend({

  // Automatically route ".json" counterpart URLs.
  autoJson: true,

  // Don't take requests until the `listen` method is called.
  isListening: false,

  // Default to HTTP rather than HTTPS.
  protocol: 'http',

  // By default, don't start off listening.
  port: null,

  // Optionally provide a key and cert file for HTTPS.
  keyPath: null,
  certPath: null,

  // Optionally keep a reference to the app that invoked Za.
  app: null,

  // Start the server.
  init: function (options) {
    var self = this;
    Type.decorate(self, options);

    // Create a router to handle requests.
    self.router = new Router(self.protocol);

    // Point an app or this server as the app.
    self.setApp(self.app || self);

    // Start listening.
    if (self.port) {
      self.listen();
    }
  },

  /**
   * Inject a parent app (such as Lighter MVC).
   * The Za server can use its log and domain.
   */
  setApp: function (app) {
    var self = this;
    self.app = app;
    self.router.app = app;
    var log = app.log || console;
    parse.log = log;
    self.log = log;
    self.domain = app.domain;
    return self;
  },

  /**
   * Route a function to a given path.
   */
  route: function (method, path, fn) {
    var self = this;
    self.router.add(method, path, fn);
    return self;
  },

  /**
   * Set a middleware function to be used, optionally on a given path.
   */
  use: function (path, fn) {
    var self = this;
    self.router.use(path, fn);
    return self;
  },

  /**
   * Remove a middleware function from usage.
   */
  unuse: function (fn) {
    var self = this;
    self.router.unuse(fn);
    return self;
  },

  /**
   * Listen for HTTP/HTTPS requests, optionally on a given port.
   */
  listen: function (port) {
    var self = this;
    port = self.port || port || defaultPort++;
    var ssl = {
      key: self.keyPath ? fs.readFileSync(self.keyPath) : 0,
      cert: self.certPath ? fs.readFileSync(self.certPath) : 0
    };
    var protocol = self.protocol;
    var router = self.router;
    var lib = require(protocol);
    var httpServer = (protocol == 'http') ?
      lib.createServer(router.serve, router) :
      lib.createServer(ssl, router.serve, router);
    router.server = self;
    router.httpServer = httpServer;
    router.autoJson = self.autoJson;
    httpServer.on('error', function (error) {
      error.message = '[Za] ' + error.message;
      throw error;
    });
    httpServer.listen(port);
    self.isListening = true;
    setImmediate(function () {
      self.log.info('[Za] ' + protocol.toUpperCase() +
        ' server listening on ' + port + '.');
    });
    return self;
  },

  /**
   * Shut the server down by stopping its router's server.
   */
  close: function () {
    var self = this;
    if (self.isListening) {
      self.router.httpServer.close();
    }
    self.isListening = false;
    return self;
  },

  /**
   * Get a requestListener-compatible interface.
   * @see https://github.com/visionmedia/supertest
   * @see http://nodejs.org/api/http.html#http_http_createserver_requestlistener
   */
  requestListener: function () {
    var self = this;
    return self.router.serve.bind(self);
  }

});

// Create HTTP method properties so that (e.g.) `app.get('/', fn)` can be called.
['CONNECT', 'DELETE', 'GET', 'HEAD',
  'OPTIONS', 'POST', 'PUT', 'TRACE'].forEach(function (method) {
  var key = method.toLowerCase();
  za.Server.prototype[key] = function (path, fn, protocol) {
    return this.router.add(method, path, fn, protocol);
  };
});

// Expose the version number, but only load package JSON if a get is performed.
Object.defineProperty(za, 'version', {
  get: function () {
    return require(__dirname + '/package.json').version;
  }
});
