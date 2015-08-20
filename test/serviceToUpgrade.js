'use strict';

global._nodeSapTestShared = global._nodeSapTestShared || {};
global._nodeSapTestShared.serviceToUpgrade = global._nodeSapTestShared.serviceToUpgrade || {};
global._nodeSapTestShared.serviceToUpgrade.load = true;
var sapAppServer = require('../index.js');
var Version = sapAppServer.Version;

module.exports = {
    initialize: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.initialize = global._nodeSapTestShared.serviceToUpgrade.initialize || 0;
        global._nodeSapTestShared.serviceToUpgrade.initialize ++;
        done();
    },
    onInitialized: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.onInitialized = global._nodeSapTestShared.serviceToUpgrade.onInitialized || 0;
        global._nodeSapTestShared.serviceToUpgrade.onInitialized ++;
        done();
    },
    checkSchema: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.checkSchema = global._nodeSapTestShared.serviceToUpgrade.checkSchema || 0;
        global._nodeSapTestShared.serviceToUpgrade.checkSchema ++;
        done();
    },
    onSchemaChecked: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.onSchemaChecked = global._nodeSapTestShared.serviceToUpgrade.onSchemaChecked || 0;
        global._nodeSapTestShared.serviceToUpgrade.onSchemaChecked ++;
        done();
    },
    initializeSchema: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.initializeSchema = global._nodeSapTestShared.serviceToUpgrade.initializeSchema || 0;
        global._nodeSapTestShared.serviceToUpgrade.initializeSchema ++;
        done();
    },
    onSchemaInitialized: function (done) {
        global._nodeSapTestShared.serviceToUpgrade.onSchemaInitialized = global._nodeSapTestShared.serviceToUpgrade.onSchemaInitialized || 0;
        global._nodeSapTestShared.serviceToUpgrade.onSchemaInitialized ++;
        done();
    },
    prepareSchemaUpgrade: function (version, done) {
        global._nodeSapTestShared.serviceToUpgrade.prepareSchemaUpgrade = global._nodeSapTestShared.serviceToUpgrade.prepareSchemaUpgrade || 0;
        global._nodeSapTestShared.serviceToUpgrade.prepareSchemaUpgrade ++;
        done();
    },
    upgradeSchema: function (version, done) {
        global._nodeSapTestShared.serviceToUpgrade.upgradeSchema = global._nodeSapTestShared.serviceToUpgrade.upgradeSchema || 0;
        global._nodeSapTestShared.serviceToUpgrade.upgradeSchema ++;
        done();
    },
    getSchemaInfo: function () {
        return {name: 'schema-info', version: new Version('1.0.0')};
    },
    onSchemaUpgraded: function (version, done) {
        global._nodeSapTestShared.serviceToUpgrade.onSchemaUpgraded = global._nodeSapTestShared.serviceToUpgrade.onSchemaUpgraded || 0;
        global._nodeSapTestShared.serviceToUpgrade.onSchemaUpgraded ++;
        done();
    },
    getHandlers: function () {
        global._nodeSapTestShared.serviceToUpgrade.getHandlers = global._nodeSapTestShared.serviceToUpgrade.getHandlers || 0;
        global._nodeSapTestShared.serviceToUpgrade.getHandlers ++;
        return {};
    }
};
