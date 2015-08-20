'use strict';
var DummyService = require('./DummyService.js');
var sapAppServer = require('../../index.js');
var Version = sapAppServer.Version;

var fooService = new DummyService('Foo');
var barService = new DummyService('Bar', true);

var services = [ fooService, barService ];

function getSchemaInfo() {
    return {name: 'schema-test', version: new Version('0.0.0')};
}

module.exports = {
    fooService: fooService,
    barService: barService,
    getSchemaInfo: getSchemaInfo
};

module.exports.getInnerServices = function () {
    return services;
};
