[![Build](https://img.shields.io/travis/sapbuild/node-sap-app-server.svg?style=flat-square)](http://travis-ci.org/sapbuild/node-sap-app-server)
[![Version](https://img.shields.io/npm/v/node-sap-app-server.svg?style=flat-square)](https://npmjs.org/package/node-sap-app-server)
[![Dependency Status](https://david-dm.org/sapbuild/node-sap-app-server.svg)](https://david-dm.org/sapbuild/node-sap-app-server)
[![devDependency Status](https://david-dm.org/sapbuild/node-sap-app-server/dev-status.svg)](https://david-dm.org/sapbuild/node-sap-app-server#info=devDependencies)
[![Coverage](https://img.shields.io/coveralls/sapbuild/node-sap-app-server/master.svg?style=flat-square)](https://coveralls.io/r/sapbuild/node-sap-app-server?branch=master)
node-sap-app-server
===================

# Overview
SAP simple configuration driven application server based on [Express](http://expressjs.com/)

SAP Application Server encapsulates all the complex logic of server initialization (database connection, dynamic service loading, Express application creation and configuration...). Everything is based on a server configuration JSON file. 

# Usage

Only a few lines of code are required to create an executable application

```javascript
var path = require('path');
var Server = require('node-sap-app-server').Server;
Server.start(path.join(__dirname, 'config.json')); // use absolute path for config file
```

# Server Configuration
The server configuration file is a JSON file made of a number of sections, each section being a JSON object or the path to the JSON file containing the section definition (paths are relative to the configuration file). You may refer to the SAP configuration file for a comprehensive example. 

##db
This section defines the connection parameters to MongoDB 
- **hosts** comma separated list of MongoDB hosts
- **database** main SAP database to connect to
- **options** options passed to the MongoDB driver

##debug
This section controls the activation of various debug features (currently only live-reload)

##deployment
This section controls the SAP deployment strategy in MongoDB through the **strategy** parameter
- **'single'** deploys SAP in a single database for development or small deployments
- **'distribute'** spreads SAP collection over multiple databases to reduce MongoDB write contention and improve performances

##env
This section allows a simple definition of environment variables which will be set on the node process (e.g. setting NODE_ENV to 'production'). 

##http
This section defines some HTTP server parameters
- **port** server port
- **hostname** server hostname

###http.proxy
**proxy** subsection of http section defines global proxy configuration for outbound http calls
- **host** proxy hostname
- **port** proxy port

###http.express
**express** subsection of **http** section defines Express configuration parameters

####http.express.app
Defines Express application settings. ```app.set(key, value)``` will called for each (key, value) pair
- 'trust proxy' setting this property to true ensures the Express application leverages the request forwarding headers to determine the actual Host value  (X-Forwarded-Proto/X-Forwarded-Host or X-ProxyBaseUrl) 

###http.tls
Defines TLS configuration for the server, cf. [http://nodejs.org/api/tls.html](http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener)

####http.tls.cwd
Defines the base path to resolve certificate and key files (default is config.json location)

####http.tls.pfx 
Path to a file containing the private key, certificate and CA certs of the server in PFX or PKCS12 format. (Mutually exclusive with the key, cert and ca options.)

####http.tls.key
Path to a file containing the private key of the server in PEM format. 

####http.tls.passphrase
A string of passphrase for the private key or pfx.

####http.tls.cert
Path to a file containing the certificate key of the server in PEM format. (Could be an array of file paths). 

####http.tls.ca
A file location or an array of file locations for the server trusted certificates in PEM format. If this is omitted several well known "root" CAs will be used, like VeriSign. These are used to authorize connections.

####http.tls.crl
A file location or an array of file locations for the pointing to PEM encoded CRLs (Certificate Revocation List)


##logging 
This section defines the server logging configuration

##server
This section defines server parameters
- **workers** defines the number of worker processes

##services
This section defines the list of server services to load and the mount point of their http handlers. 

For each server module, you should define a mounting configuration

###SAP module API 
A SAP server module.exports should return an object exposing the following optional methods
- **initialize** offers an entry point to perform service initialization. At this stage, the service may assume that basic services are available (configuration, logging, database connection). The initialize method may be synchronous or asynchronous (see below). 
- **onInitialized** offers an entry point to perform additional startup logic. At this stage, the service may assume that all services have completed initialization. In particular, at this stage all services should be available in the registry. 
- **shutdown** allows proper service shutdown. 
- **getHandlers** allows a service to expose its http handlers which will mounted according to the configuration. The service must return an object whose properties are the various handler names. The corresponding property values may either be single handlers or array of handlers which will be mounted serially at the same location. 

###Mounting configuration
Mounting configuration may be a string containing the path at which all module handlers will be mounted (convenient for services exposing a single handler) or a hash defining for each handler name the mounting path. 

###Synchronous/Asynchronous callbacks 
Apart from the getHandlers callback which is always synchronous, all callback may be either synchronous or asynchronous. 
If the method exposed by the service takes no parameter it must be a synchonous one. Otherwise, it is considered asynchronous and must take as unique parameter a standard callback function cb(err). In that case, the server will pause and wait for the callback before resuming initialization. 


##web
This section controls the static web content
- **root** path to the static content folder, relative to the configuration file
- **indexFallback** array of root paths for which unhandled request should return the index.html page rather than a 404 error for Angular deep-linking
- **compression** options passed to the compression middleware 

#3 Schema operations

It’s possible to start the server so to run some schema operations: 
  checkSchema, initSchema, upgradeSchema

```javascript
var path = require('path');
var AppServer = require('node-sap-app-server');
var server = new AppServer.Server(path.join(__dirname, 'config.json'));
server.checkSchema()
```

Once the operation is completed, the server is shut down.

When running checkSchema, if implemented by services, these methods are called in this order:
	checkSchema(), then onSchemaChecked()

When running initSchema:
	initSchema(), then onSchemaInitialized(), then checkSchema(), then onSchemaChecked()
	
When running upgradeSchema:
	prepareUpgrade(), then upgradeSchema(), then onSchemaUpgraded(), then checkSchema(), then onSchemaChecked()

