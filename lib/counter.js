var debug = require('debug')('download-counter');
var config = require('../config')
var Knex = require('knex');
var knex = Knex.initialize({
    client: 'sqlite3',
    connection: config.database
});

exports = module.exports;

exports.count = function (filename, cb) {
    return knex('counter').where({
        filename: filename
    }).select('count').then(
        function(resp) {
            if (resp.length == 0) {
                cb(null, 0);
            } else {
                cb(null, resp[0].count);
            }
        }, function(err) {
            cb(err);
        }
    );
}

exports.increase = function (filename) {
    knex.transaction(function (t) {
        knex('counter').transacting(t).where({
            filename: filename
        }).count('filename as cnt').then(function(resp) {
            if (resp[0].cnt == 0) {
                return knex('counter').transacting(t).insert({filename: filename});
            } else {
                return knex('counter').transacting(t).where({filename: filename}).increment('count', 1);
            }
        }).then(function() {
            t.commit()
        }, t.rollback);
    });
}

exports.init = function () {
    return knex.schema.hasTable('counter').then(function (exists) {
        if (!exists) {
            return knex.schema.createTable('counter', function(table) {
                table.string('filename').index();
                table.integer('count').defaultTo(1);
            });
        }
    });
}
