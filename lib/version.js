'use strict';
var utils = require('./utils.js');

/**
 * Construct a new Version object
 * @param {string | Version} version
 * @constructor
 */
function Version(version) {
    version = version || '0.0.0';
    if (typeof version === 'string') {
        var VERSION_REG = new RegExp(/^[0-9]+\.[0-9]+\.[0-9]+$/);
        if (!VERSION_REG.test(version)) {
            throw new TypeError('Invalid version format');
        }
        var parts = version.split('.');
        this.major = utils.toInt(parts[0]);
        this.minor = utils.toInt(parts[1]);
        this.patch = utils.toInt(parts[2]);
    }
    else if (version instanceof Version) {
        this.major = version.major;
        this.minor = version.minor;
        this.patch = version.patch;
    }
    else if (typeof version === 'object') {
        // Enforce major, minor and patch to be integers
        this.major = ~~version.major;
        this.minor = ~~version.minor;
        this.patch = ~~version.patch;
    }
    else {
        throw new TypeError('Invalid version argument');
    }
}

Version.prototype.toString = function () {
    return this.major + '.' + this.minor + '.' + this.patch;
};

Version.prototype.compareTo = function (v) {
    return Version.compare(this, v);
};

function compare(x, y) {
    if (x < y) {
        return -1;
    }
    else if (x > y) {
        return 1;
    }
    return 0;
}

Version.toVersion = function (v) {
    if (v instanceof Version) {
        return v;
    }
    return new Version(v);
};

Version.compare = function (x, y) {
    var vx = Version.toVersion(x);
    var vy = Version.toVersion(y);
    return compare(vx.major, vy.major) || compare(vx.minor, vy.minor) || compare(vx.patch, vy.patch);
};

Version.compareIgnorePatch = function (x, y) {
    var vx = Version.toVersion(x);
    var vy = Version.toVersion(y);
    return compare(vx.major, vy.major) || compare(vx.minor, vy.minor);
};

module.exports = Version;
