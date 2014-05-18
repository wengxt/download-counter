var directory = require('./lib/directory');
var counter = require('./lib/counter');
var express = require('express');
var path = require('path');
var config = require('./config');
var app = express();

counter.init().then(function () {
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');
    app.use('/', express.static(path.join(__dirname, 'public')));
    app.use('/', directory(config.path));

    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
});

module.exports = app;
