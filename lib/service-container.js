'use strict';

var util = require('util');
var logger = require('./logger');
var Version = require('./version');

function ServiceContainer(config) {
    config = config || {};
    var serviceConfig = {};
    if (config.handlers || config.filters || config.locations) {
        serviceConfig.filters = util._extend({}, config.filters);
        serviceConfig.handlers = util._extend({}, config.handlers);
        serviceConfig.locations = (Array.isArray(config.locations) ? config.locations.slice() : []);
    }
    else {
        serviceConfig.handlers = util._extend({}, config);
        serviceConfig.filters = {};
        serviceConfig.locations = [];
    }
    this.config = serviceConfig;
    this.services = {};
}
module.exports = ServiceContainer;

function addUrlParams(req, res, next) {
    var k, n, param, params;
    if (req.params) {
        params = Object.keys(req.params);
        req.urlParams = {};
        for (k = 0, n = params.length; k < n; ++k) {
            param = params[k];
            req.urlParams[param] = req.params[param];
        }
    }
    next();
}

function execute(services, fnName, taskName, argObject) {
    var k, n, serviceNames, isArray = Array.isArray(services);
    if (!isArray) {
        serviceNames = Object.keys(services);
    }
    taskName = taskName || fnName;
    function failHandler(serviceName) {
        return function (err) {
            logger.error(err, 'Failed to execute ' + taskName + ' on service ' + serviceName);
            throw err;
        };
    }

    logger.debug('Running ' + taskName);
    n = (isArray ? services.length : serviceNames.length);
    k = 0;
    function nextService() {
        var cbInvoke, name, service, result;
        if (k >= n) {
            return Promise.resolve(true);
        }
        if (isArray) {
            service = services[k];
            name = service.name || k.toString();
        }
        else {
            name = serviceNames[k];
            service = services[name];
        }
        k++;
        logger.debug('Running ' + taskName + ' on service ' + name);

        if (service) {
            cbInvoke = executeOnService(service, fnName, taskName, argObject);
            result = cbInvoke
                .then(nextService)
                .catch(failHandler(name));
        }
        else {
            result = nextService();
        }
        return result;
    }

    return nextService();
}

function executeOnService(service, fnName, taskName, argObject) {
    var cbInvoke;
    if (typeof service[fnName] === 'function') {
        if (argObject) {
            cbInvoke = (service[fnName].length === 0 ? Promise.fnCall(service, fnName, argObject) : Promise.invoke(service, fnName, argObject));
        }
        else {
            // Synchronous callback function has no parameter
            cbInvoke = (service[fnName].length === 0 ? Promise.fnCall(service, fnName) : Promise.invoke(service, fnName));
        }
    }
    else {
        cbInvoke = Promise.resolve(true);
    }
    if (typeof service.getInnerServices === 'function') {
        // Service may expose a getSubServices function returning services on which to cascade callback
        cbInvoke = cbInvoke.then(function () {
            return execute(service.getInnerServices(), fnName, taskName, argObject);
        });
    }
    return cbInvoke;
}

ServiceContainer.execute = execute;

ServiceContainer.prototype.getFilterModules = function () {
    var aKeys, nbFilters, filterIndex, filter, filters, filterModules = [];
    filters = this.config.filters;
    aKeys = Object.keys(filters);
    nbFilters = aKeys.length;
    for (filterIndex = 0; filterIndex < nbFilters; filterIndex++) {
        filter = filters[aKeys[filterIndex]];
        filterModules.push(filter.module);
    }
    return filterModules;
};

ServiceContainer.prototype.loadServices = function () {
    var handlers, serviceNames, loader = this.serviceLoader, self = this;
    var fnLoader = (typeof loader === 'function');
    logger.debug('Loading services');
    handlers = Object.keys(this.config.handlers);
    serviceNames = handlers.concat(this.getFilterModules());
    return new Promise(function (resolve, reject) {
        var k, n, service;
        n = serviceNames.length;
        for (k = 0; k < n; ++k) {
            service = serviceNames[k];
            if (!self.services[service]) {
                try {
                    logger.debug('Loading service ' + service);
                    self.services[service] = (fnLoader ? loader(service) : loader.require(service));
                }
                catch (err) {
                    logger.error('Failed to load service ' + service + ': ' + err.message + '\n' + err.stack);
                    reject(err);
                    return;
                }
            }
        }
        resolve(true);
    });
};

ServiceContainer.prototype.addService = function (name, service, httpConfig) {
    logger.debug('Registering custom service ' + name);
    if (this.services[name]) {
        throw new Error('Service \'' + name + '\' already registered');
    }
    this.services[name] = service;
    this.config.handlers[name] = httpConfig;
};

ServiceContainer.prototype.addServices = function (serviceContainer) {
    var k, n, name, names;
    if (serviceContainer && serviceContainer.config && serviceContainer.services) {
        names = Object.keys(serviceContainer.services);
        for (k = 0, n = names.length; k < n; ++k) {
            name = names[k];
            this.addService(name, serviceContainer.services[name], serviceContainer.config.handlers[name]);
        }
    }
};

ServiceContainer.prototype.initializeServices = function () {
    return execute(this.services, 'initialize');
};

ServiceContainer.prototype.onInitialized = function () {
    return execute(this.services, 'onInitialized', 'on-initialized');
};

ServiceContainer.prototype.shutdownServices = function () {
    return execute(this.services, 'shutdown');
};

ServiceContainer.prototype.checkSchema = function () {
    return execute(this.services, 'checkSchema');
};

ServiceContainer.prototype.onSchemaChecked = function () {
    return execute(this.services, 'onSchemaChecked', 'on-schemaChecked');
};

ServiceContainer.prototype.initializeSchema = function () {
    return execute(this.services, 'initializeSchema');
};

ServiceContainer.prototype.onSchemaInitialized = function () {
    return execute(this.services, 'onSchemaInitialized', 'on-schemaInitialized');
};

ServiceContainer.prototype.prepareSchemaUpgrade = function (schemaInfo) {
    return this.upgradeSchemaStep(schemaInfo, 'prepareSchemaUpgrade');
};

ServiceContainer.prototype.upgradeSchema = function (schemaInfo) {
    return this.upgradeSchemaStep(schemaInfo, 'upgradeSchema');
};

ServiceContainer.prototype.onSchemaUpgraded = function (schemaInfo) {
    return this.upgradeSchemaStep(schemaInfo, 'onSchemaUpgraded', 'on-schemaUpgraded');
};

ServiceContainer.prototype.upgradeSchemaStep = function (schemaInfo, fnName, taskName) {
    logger.debug('Running upgradeSchemaStep');
    var service, services = this.services, serviceInfo, serviceInfoArray = [], n, k, j, key;
    function notExistInServiceInfoArray(serviceName) {
        for (j = 0; j < serviceInfoArray.length; ++j) {
            if (serviceInfoArray[j].serviceName === serviceName) {
                return false;
            }
        }
        return true;
    }
    Object.keys(schemaInfo).forEach(function (schemaName) {
        var version = schemaInfo[schemaName].version;
        var dbVersion = schemaInfo[schemaName].dbVersion;
        var serviceNames = schemaInfo[schemaName].services;
        var cmp = Version.compareIgnorePatch(dbVersion, version);
        if (cmp < 0) {
            for (key = 0; key < serviceNames.length; ++key) {
                if (notExistInServiceInfoArray(serviceNames[key])) {
                    serviceInfoArray.push({serviceName: serviceNames[key], dbVersion: Version.toVersion(dbVersion), version: version});
                }
            }
        }
    });

    n = serviceInfoArray.length;
    k = 0;
    function nextExecuteOnService() {
        var result;
        if (k >= n) {
            return Promise.resolve(true);
        }
        serviceInfo = serviceInfoArray[k];
        k++;
        if (serviceInfo) {
            service = services[serviceInfo.serviceName];
            result = executeOnService(service, fnName, taskName, serviceInfo.dbVersion)
                .then(nextExecuteOnService)
                .catch(function (err) {
                    logger.error(err, 'Failed to execute ' + fnName + ' on service ' + serviceInfo.serviceName);
                    throw err;
                });
        }
        else {
            result = nextExecuteOnService();
        }
        return result;
    }
    return nextExecuteOnService();
};

ServiceContainer.prototype.updateSchemaInfo = function (configService, schemaInfo) {
    var error, promises = [];
    if (!configService) {
        return Promise.resolve(true);
    }
    Object.keys(schemaInfo).forEach(function (schemaName) {
        var version = schemaInfo[schemaName].version;
        promises.push(configService.set(schemaName, version.toString())
              .catch(function (err) {
                error = error || new Error('Failed to update the version of the schema ' + schemaName + ' in the database');
                error.inner = error.inner || [];
                error.inner.push(err);
                logger.warn(err.message);
            }));
    });
    if (error) {
        throw error;
    }
    return Promise.all(promises);
};

ServiceContainer.prototype.getServiceSchemaInfo = function () {
    var services = this.services;
    logger.debug('Retrieving schema information from services');
    var map = {};
    Object.keys(services).forEach(function (serviceName) {
        var schemaEntry, error, schemaInfo, version, service = services[serviceName];
        if (!service || (typeof service.getSchemaInfo !== 'function')) {
            logger.debug('getSchemaInfo function is not defined on service ' + serviceName);
            return;
        }
        schemaInfo = service.getSchemaInfo();
        version = new Version(schemaInfo.version);
        schemaEntry = map[schemaInfo.name];
        if (schemaEntry) {
            if (schemaInfo.version.compareTo(version)) {
                error = new Error('Incompatible version for schema ' + schemaInfo.name + ' between service ' + serviceName + ' and service(s) ' + schemaInfo.services.join(', '));
                logger.error(error);
                throw error;
            }
            schemaEntry.services.push(serviceName);
        }
        else {
            map[schemaInfo.name] = {
                version: version,
                services: [ serviceName ]
            };
        }
    });
    return map;
};

ServiceContainer.prototype.getDbSchemaInfo = function (configService, map) {
    logger.debug('Retrieving schema information from database');
    var promises = [];
    if (!configService) {
        return Promise.resolve(map);
    }
    Object.keys(map).forEach(function (schemaName) {
        promises.push(
            configService.get(schemaName)
                .then(function (strDbVersion) {
                    if (strDbVersion) {
                        map[schemaName].dbVersion = new Version(strDbVersion);
                    }
                })
        );
    });
    return Promise.all(promises)
        .then(function () {
            return map;
    });
};

ServiceContainer.prototype.getSchemaInfo = function (configService) {
    var self = this;
    return Promise.fnCall(
        function () {
            return self.getServiceSchemaInfo();
        })
        .then(function (map) {
            return self.getDbSchemaInfo(configService, map);
        });
};

ServiceContainer.prototype.checkSchemaVersions = function (configService) {
    logger.debug('Check schema versions');
    if (!configService) {
        return Promise.resolve(true);
    }
    return this.getSchemaInfo(configService)
        .then(function (map) {
            var error;
            Object.keys(map).forEach(function (schemaName) {
                    if (map[schemaName].dbVersion) {
                        var err, cmp = Version.compareIgnorePatch(map[schemaName].dbVersion, map[schemaName].version);
                        if (cmp) {
                            error = error || new Error('Schema version mismatch');
                            error.inner = error.inner || [];
                            if (cmp > 0) {
                                err = new Error('Database version is greater than module version for schema ' + schemaName + ', server upgrade required');
                            }
                            else {
                                err = new Error('Database version is lower than module version for schema ' + schemaName + ', database upgrade required');
                            }
                            logger.warn(err.message);
                            error.inner.push(err);
                        }
                    }
                });
            if (error) {
                throw error;
            }
        });
};

ServiceContainer.prototype.checkDbSchemaIsLower = function (schemaInfo) {
    var error, strictlyLower = false;
    Object.keys(schemaInfo).forEach(function (schemaName) {
        var err, cmp = Version.compareIgnorePatch(schemaInfo[schemaName].dbVersion, schemaInfo[schemaName].version);
        if (cmp > 0) {
            error = error || new Error('Schema version mismatch');
            error.inner = error.inner || [];
            err = new Error('Database version is greater than module version for schema ' + schemaName + ', server upgrade required');
            logger.warn(err.message);
            error.inner.push(err);
        }
        else if (cmp < 0) {
            strictlyLower = true;
        }
    });
    if (error) {
        throw error;
    }
    return strictlyLower;
};

function mountServiceHttpHandlers(app, name, handlerConfig, service) {
    var handlers;
    logger.debug('Mounting http handlers for service ' + name);
    switch (typeof service) {
        case 'function':
            // Legacy service API
            logger.warn('Legacy service ' + name + ' should be migrated');
            service(app);
            break;
        case 'object':
            if (typeof service.getHandlers === 'function') {
                handlers = service.getHandlers();
                if (handlers) {
                    Object.keys(handlers).forEach(function (handlerName) {
                        var location, handler = handlers[handlerName];
                        switch (typeof handlerConfig) {
                            case 'string':
                                // simple case, mount all handlers under the same path
                                location = handlerConfig;
                                break;
                            case 'object':
                                location = handlerConfig[handlerName];
                                break;
                            default:
                                throw new TypeError('Invalid configuration for service ' + name);
                        }
                        if (location === undefined) {
                            logger.warn('Missing configuration for handler ' + handlerName + ', handler will be deactivated');
                        }
                        else if (location === null) {
                            logger.info('Http handler ' + handlerName + ' deactivated');
                        }
                        else {
                            app.use(location, addUrlParams);
                            if (Array.isArray(handler)) {
                                // Mount multiple handlers at the same location
                                logger.debug('Mounting ' + handler.length + ' http handlers ' + handlerName + ' at location ' + location);
                                handler.forEach(function (h) {
                                    app.use(location, h);
                                });
                            }
                            else {
                                logger.debug('Mounting http handler ' + handlerName + ' at location ' + location);
                                app.use(location, handler);
                            }
                        }
                    });
                }
            }
            break;
        default:
            logger.warn('Service ' + name + ' has an invalid module');
    }
}

ServiceContainer.prototype.mountHttpHandlers = function (app) {
    var config = this.config.handlers, services = this.services;
    var serviceNames = Object.keys(config);
    logger.debug('Mounting http handlers');
    return new Promise(function (resolve, reject) {
        var k, n, name, handlerConfig, service;
        n = serviceNames.length;
        for (k = 0; k < n; ++k) {
            name = serviceNames[k];
            handlerConfig = config[name];
            service = services[name];
            try {
                if (handlerConfig === undefined) {
                    logger.warn('Missing configuration for service ' + name + ', http handlers will be deactivated');
                }
                if (handlerConfig === null) {
                    logger.info('Http handlers deactivated for service ' + name);
                }
                else {
                    mountServiceHttpHandlers(app, name, handlerConfig, service);
                }
            }
            catch (err) {
                logger.warn('Failed to mount http handlers for service ' + name + ': ' + err.message + '\n' + err.stack);
                reject(err);
                return;
            }
        }
        resolve(true);
    });
};

ServiceContainer.prototype.getFilters = function () {
    var aKeys, filter, nbFilters, filterIndex, result = {};
    aKeys = Object.keys(this.config.filters);
    nbFilters = aKeys.length;
    for (filterIndex = 0; filterIndex < nbFilters; filterIndex++) {
        filter = this.config.filters[aKeys[filterIndex]];
        result[aKeys[filterIndex]] = {
            module: filter.module,
            filterName: filter.filter,
            filterFunction: this.services[filter.module].getFilter(filter.filter, filter.options)
        };
    }
    return result;
};

ServiceContainer.prototype.getLocations = function () {
    var result = [];
    var aRoutes, nbLocations, locationIndex, nbRoutes, routeIndex, route, location, configLocation;
    var nbFilters, filterName, filters, aFilters, filterIndex;
    if (Array.isArray(this.config.locations)) {
        nbLocations = this.config.locations.length;
        filters = this.getFilters();
        for (locationIndex = 0; locationIndex < nbLocations; locationIndex++) {
            configLocation = this.config.locations[locationIndex];
            aRoutes = Object.keys(configLocation);
            nbRoutes = aRoutes.length;
            location = {};
            for (routeIndex = 0; routeIndex < nbRoutes; routeIndex++) {
                route = aRoutes[routeIndex];
                aFilters = configLocation[route];
                if (Array.isArray(aFilters)) {
                    nbFilters = aFilters.length;
                    location[route] = [];
                    for (filterIndex = 0; filterIndex < nbFilters; filterIndex++) {
                        filterName = aFilters[filterIndex];
                        location[route].push(filters[filterName]);
                    }
                }
            }

            result.push(location);
        }
    }
    return result;
};

ServiceContainer.prototype.mountFilters = function (app) {
    var self = this;
    logger.debug('Mounting http filters');
    return new Promise(function (resolve, reject) {
        var k, n, route, currLocationIndex, location;
        var filtersRoutes;
        var locations = self.getLocations();
        var nbLocations = locations.length;
        for (currLocationIndex = 0; currLocationIndex < nbLocations; currLocationIndex++) {
            location = locations[currLocationIndex];
            filtersRoutes = Object.keys(location);
            n = filtersRoutes.length;
            for (k = 0; k < n; ++k) {
                route = filtersRoutes[k];
                try {
                    mountServiceFilters(app, route, location[route]);
                }
                catch (err) {
                    logger.warn(err, 'Failed to mount http filters for location ' + route);
                    reject(err);
                    return;
                }
            }
        }
        resolve(true);
    });
};

function mountServiceFilters(app, route, routeFilters) {
    logger.debug('Mounting filters for route ' + route);

    if (routeFilters && Array.isArray(routeFilters)) {
        var k, n = routeFilters.length, filter;
        for (k = 0; k < n; k++) {
            filter = routeFilters[k];
            logger.debug('Mounting http filter ' + filter.filterName + ' from module ' + filter.module + ' at location ' + route);
            app.use(route, filter.filterFunction);
        }
    }
}
