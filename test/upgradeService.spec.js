'use strict';

var util = require('util');
var expect = require('chai').expect;
var sapAppServer = require('../index.js');
var Version = sapAppServer.Version;
var path = require('path');
var defaultConfig = require('./config.json');
var db = require('node-sap-mongo');
var mongoConfig = require('node-sap-mongo-config');
var ConfigService = mongoConfig.ConfigService;


describe('Upgrade schema of service', function () {
    var COLLECTIONNAME = 'schemaInfo';
    this.timeout(30000);
    function dbConnect(config) {
        return new Promise(function (resolve, reject) {
            if (config.db && config.deployment) {
                db.connection.initialize(config.db, config.deployment)
                    .then(resolve)
                    .catch(function (dbErr) {
                        reject(dbErr);
                    });
            }
            else {
                resolve();
            }
        });
    }
    function execTaskOnDb(task, name, value) {
        var config = util._extend({}, defaultConfig);
        return dbConnect(config)
            .then(function () {
                return Promise.fnCall(function () {
                    return ConfigService.create(db.connection.getDb(), {collection: COLLECTIONNAME});
                });
            })
            .then(function (configService) {
                if (!configService) {
                    return Promise.resolve(true);
                }
                return Promise.fnCall(
                    function () {
                        if (typeof task === 'string' && typeof name === 'string') {
                            return configService[task](name, value);
                        }
                    }
                );
            });
    }

    before(function (done) {
        var service = require('./serviceToUpgrade.js'),
            schemaInfo = service.getSchemaInfo();
        return execTaskOnDb('set', schemaInfo.name, '0.0.0')
            .then(function () {
                return db.connection.disconnect(done);
            })
            .catch(function (err) {
                done(err);
            });
    });
    after(function (done) {
        var service = require('./serviceToUpgrade.js'),
            schemaInfo = service.getSchemaInfo();
        return execTaskOnDb('delete', schemaInfo.name)
            .then(function () {
                return db.connection.disconnect(done);
            })
            .catch(function (err) {
                done(err);
            });
    });

    it('should upgrade schema from 0.0.0 to 1.0.0', function (done) {
        var config = util._extend({}, defaultConfig);
        config.services = {handlers: {}};
        config.services.handlers[path.resolve(__dirname, './serviceToUpgrade.js')] = '';
        var server = new sapAppServer.Server(config);
        server.upgradeSchema(true).then(function () {
            expect(server.appServer.status).to.equal('stopped');
            var service = global._nodeSapTestShared.serviceToUpgrade;
            expect(service.load).to.equal(true);
            expect(service.initialize).to.equal(1);
            expect(service.onInitialized).to.equal(1);
            expect(service.prepareSchemaUpgrade).to.equal(1);
            expect(service.upgradeSchema).to.equal(1);
            expect(service.onSchemaUpgraded).to.equal(1);
            return server.appServer.shutdown(true);
        }).then(function () {
            expect(server.appServer.status).to.equal('stopped');
            done();
        }).catch(function (err) {
            done(err);
        });
    });
    it('Check if the schema info was updated', function (done) {
        var service = require('./serviceToUpgrade.js'),
            schemaInfo = service.getSchemaInfo(),
            schemaVersion = new Version(schemaInfo.version);
        execTaskOnDb('get', schemaInfo.name)
            .then(function (version) {
                var dbVersion = new Version(version),
                    cmp = dbVersion.compareTo(schemaVersion);
                expect(cmp).to.equal(0);
            })
            .then(function () {
                return db.connection.disconnect(done);
            })
            .catch(function (err) {
                done(err);
            });
    });

    it('should throw an error', function (done) {
        var service = require('./serviceToUpgrade.js'),
            schemaInfo = service.getSchemaInfo();
        execTaskOnDb('set', schemaInfo.name, '2.0.0')
            .then(function () {
                return db.connection.disconnect();
            })
            .then(function () {
                var config = util._extend({}, defaultConfig);
                config.services = {handlers: {}};
                config.services.handlers[path.resolve(__dirname, './serviceToUpgrade.js')] = '';
                var server = new sapAppServer.Server(config);
                expect(server.upgradeSchema).to.throw();
                done();
            })
            .catch(function (err) {
                done(err);
            });

    });

});
