
// Ported from: https://github.com/pinf-to/pinf-to-mozilla-firefox-profile

const Promise = require("bluebird");
const PATH = require("path");
const FS = Promise.promisifyAll(require("fs-extra"));
FS.existsAsync = function (path) { return new Promise(function (resolve, reject) { try { return FS.exists(path, resolve); } catch (err) { return reject(err); } }); };
const HTTP = require("http");
const CONNECT = require("connect");
const CODEBLOCK = require("codeblock");
const SPAWN = require("child_process").spawn;
const CRYPTO = require("crypto");
const SMI = require("smi.cli");


const VERBOSE = process.env.VERBOSE || false;

const DEFAULT_BROWSER_VERSION = "52.0";

// TODO: Get free port dynamically.
const PORT = 8073;

exports.run = function (config) {

    const configKey = CRYPTO.createHash("sha1").update(JSON.stringify(config)).digest("hex");

    config.label = "[it.pinf.org.mozilla.firefox] " + (config.label || configKey);

    const PROFILE_BASE_PATH = PATH.join(process.cwd(), ".rt/it.pinf.org.mozilla.firefox/profiles/ck-" + configKey);
    if (!FS.existsSync(PROFILE_BASE_PATH)) FS.mkdirsSync(PROFILE_BASE_PATH);

    var BROWSERS_BASE_PATH = null;   
    if (process.env.BO_GLOBAL_SYSTEM_CACHE_DIR) {
        BROWSERS_BASE_PATH = PATH.join(process.env.BO_GLOBAL_SYSTEM_CACHE_DIR, "it.pinf.org.mozilla.firefox/browsers");
    } else {
        BROWSERS_BASE_PATH = PATH.join(process.cwd(), ".rt/it.pinf.org.mozilla.firefox/browsers");
    }
    if (!FS.existsSync(BROWSERS_BASE_PATH)) FS.mkdirsSync(BROWSERS_BASE_PATH);


	// @see http://kb.mozillazine.org/Command_line_arguments

	var Profile = function (options) {

		this._options = options || {};

		this._process = null;

		this._options.browserVersion = this._options.browserVersion || DEFAULT_BROWSER_VERSION;

		var defaultPreferences = {
			"javascript.options.showInConsole": true,
			"nglayout.debug.disable_xul_cache": true,
			"browser.dom.window.dump.enabled":  true,
			"javascript.options.strict": true,
			"extensions.logging.enabled": true,
			"browser.tabs.warnOnClose": false,
			"browser.rights.3.shown": true,
			"browser.shell.checkDefaultBrowser": false,
			"browser.startup.homepage_override.mstone": "ignore",
			"extensions.autoDisableScopes": 0
	//		"devtools.debugger.log.verbose": true
	//		"devtools.dump.emit": true
		};
		this._options.preferences = this._options.preferences || {};
		for (var name in defaultPreferences) {
			if (typeof this._options.preferences[name] === "undefined") {
				this._options.preferences[name] = defaultPreferences[name];
			}
		}
		if (this._options.homepage) {
            var homepage = this._options.homepage;
            if (/^\/(?!\/)/.test(homepage)) {
                homepage = "http://" + "127.0.0.1:" + PORT + homepage;
            }
			this._options.preferences["browser.startup.homepage"] = homepage;
		}
	}

	Profile.prototype.init = function() {
		var self = this;

        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.init()");

        function ensureClean () {

            console.log("[it.pinf.org.mozilla.firefox] Profile.init()>ensureClean()");

			if (!self._options.clean) {
                return Promise.resolve(null);
            }
            return FS.existsAsync(PROFILE_BASE_PATH).then(function (exists) {
                if (!exists) {
                    return null;
                }
                return FS.removeAsync(PROFILE_BASE_PATH).then(function () {
                    return FS.mkdirsAsync(PROFILE_BASE_PATH);
                });
            });
        }

		function ensureDescriptor () {

            if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.init()>ensureDescriptor()");
            
			var profileDescriptorPath = PATH.join(PROFILE_BASE_PATH, "package.json");

			function updateMissing (descriptor) {

				if (!descriptor.name) {
					descriptor.name = "it.pinf.org.mozilla.firefox~profile";
				}

				if (!descriptor.config) {
					descriptor.config = {
				    	"smi.cli": {
					        "latestOnly": true
//                            "packagesDirectory": "."
					    }
					};
				}
				if (!descriptor.config.profile) {
					descriptor.config.profile = {};
				}
				if (!descriptor.config.browser) {
					descriptor.config.browser = {};
				}

				if (typeof descriptor.config.profile.name === "undefined") {
					var date = new Date();
					descriptor.config.profile.name = self._options.name || [
						date.getUTCFullYear(),
						("0" + date.getUTCMonth()).replace(/^0?(\d{2})$/, "$1"),
						("0" + date.getUTCDate()).replace(/^0?(\d{2})$/, "$1"),
						"-",
						("0" + date.getUTCHours()).replace(/^0?(\d{2})$/, "$1"),
						("0" + date.getUTCMinutes()).replace(/^0?(\d{2})$/, "$1"),
						("0" + date.getUTCSeconds()).replace(/^0?(\d{2})$/, "$1")
					].join("");
				}

				if (typeof descriptor.config.browser.version === "undefined") {
					descriptor.config.browser.version = self._options.browserVersion;
				}

				var browserMappingKey = "/firefox-" + descriptor.config.browser.version;

				if (typeof descriptor.config.browser.installPath === "undefined") {
					descriptor.config.browser.installPath = self._options.browserInstallPath || PATH.join(PROFILE_BASE_PATH, "_packages", browserMappingKey);
				}

				// TODO: Look for other paths on other platforms.
				if (require("os").type().toLowerCase() == "darwin") {
					if (self._options.browserRelease === "nightly") {
						descriptor.config.browser.binPath = PATH.join(descriptor.config.browser.installPath, "FirefoxNightly.app/Contents/MacOS/firefox-bin");
					} else {
						descriptor.config.browser.binPath = PATH.join(descriptor.config.browser.installPath, "Firefox.app/Contents/MacOS/firefox-bin");
					}
				} else
				if (require("os").type().toLowerCase() == "linux") {
					if (self._options.browserRelease === "nightly") {
						descriptor.config.browser.binPath = PATH.join(descriptor.config.browser.installPath, "firefox-bin");
					} else {
						descriptor.config.browser.binPath = PATH.join(descriptor.config.browser.installPath, "firefox-bin");
					}
				} else {
					throw new Error("OS '" + require("os").type() + "' not supported!");
				}

				if (!descriptor.mappings) {
					descriptor.mappings = {};
				}
				if (typeof descriptor.mappings[browserMappingKey + "[platform=darwin]"] === "undefined") {
					if (self._options.browserDownload) {
						descriptor.mappings[browserMappingKey + "[platform=darwin]"] = self._options.browserDownload;
					} else
					if (self._options.browserRelease === "nightly") {
						descriptor.mappings[browserMappingKey + "[platform=darwin]"] = "http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-trunk/firefox-" + descriptor.config.browser.version + ".en-US.mac.dmg";
					} else {
						descriptor.mappings[browserMappingKey + "[platform=darwin]"] = "http://download-origin.cdn.mozilla.net/pub/firefox/releases/" + descriptor.config.browser.version + "/mac/en-US/Firefox%20" + descriptor.config.browser.version + ".dmg";
					}
				}

				if (typeof descriptor.mappings[browserMappingKey + "[platform=linux&arch=x64]"] === "undefined") {
					if (self._options.browserDownload) {
						descriptor.mappings[browserMappingKey + "[platform=linux&arch=x64]"] = self._options.browserDownload;
					} else
					if (self._options.browserRelease === "nightly") {
						descriptor.mappings[browserMappingKey + "[platform=linux&arch=x64]"] = "https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/firefox-" + descriptor.config.browser.version + ".en-US.linux-x86_64.tar.bz2";
					} else {
						descriptor.mappings[browserMappingKey + "[platform=linux&arch=x64]"] = "http://download-origin.cdn.mozilla.net/pub/firefox/releases/" + descriptor.config.browser.version + "/linux-x86_64/en-US/firefox-" + descriptor.config.browser.version + ".tar.bz2";
					}
				}

				var extensions = self._options.extensions || {};
				for (var id in extensions) {
					if (typeof descriptor.mappings["./extensions/" + id] === "undefined") {
						descriptor.mappings["./extensions/" + id] = {
							location: extensions[id],
							filelink: !/\.xpi$/.test(extensions[id]),
							copy: /\.xpi$/.test(extensions[id])
						}
					}
				}

				return descriptor;
			}

            return FS.existsAsync(profileDescriptorPath).then(function (exists) {

                if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.init()>ensureDescriptor() exists", exists);

                if (!exists) {
                    return updateMissing({});
                }
                return FS.readJsonAsync(profileDescriptorPath).then(function (profile) {

                    if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.init()>ensureDescriptor() profile", profile);

                    return updateMissing(profile);
                });
			}).then(function(descriptor) {
                return FS.outputFileAsync(profileDescriptorPath, JSON.stringify(descriptor, null, 4)).then(function () {
					return descriptor;
				});
			});
		}

		function ensureProfileCustomizations() {

			var path = PATH.join(PROFILE_BASE_PATH, "user.js");
			// TODO: Update preferences in existing file.
			if (!FS.existsSync(path)) {
				if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Writing profile config options to '" + path + "'");
				var preferencesJS = [];
				for (var name in self._options.preferences) {
					preferencesJS.push('user_pref("' + name + '", ' + JSON.stringify(self._options.preferences[name]) + ');');
				}
				FS.outputFileSync(path, preferencesJS.join("\n"));
			}

			var extensionsPath = PATH.join(PROFILE_BASE_PATH, "extensions");
			if (!FS.existsSync(extensionsPath)) {
				FS.mkdirsSync(extensionsPath);
			}

			return Promise.resolve(null);
		}

        return ensureClean().then(function () {

            return ensureDescriptor().then(function (descriptor) {

                if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Browser descriptor", descriptor);

                self._descriptor = descriptor;
                return new Promise(function (resolve, reject) {

                    if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Run SMI on directory:", PROFILE_BASE_PATH);

                    return SMI.install(PROFILE_BASE_PATH, PATH.join(PROFILE_BASE_PATH, "package.json"), {
                        verbose: self._options.verbose || process.env.VERBOSE || false,
                        debug: self._options.debug || process.env.DEBUG || false,
                        latestOnly: true
                    }, function (err, info) {
                        if (err) return reject(err);
                        return resolve(null);
                    });
                });
            });
        }).then(function() {
			return ensureProfileCustomizations();
		});
	}

	Profile.prototype.start = function() {
		var self = this;
        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.start()");
        return new Promise(function (resolve, reject) {
			if (self._process) {
                return reject(new Error("Process already started!"));
			}

            if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.start() binPath:", self.getBrowserBinPath());
            if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.start() PROFILE_BASE_PATH:", PROFILE_BASE_PATH);
            if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.start() process.cwd():", process.cwd());

		    var proc = SPAWN(self.getBrowserBinPath(), [
				"-profile", PROFILE_BASE_PATH,
				"-no-remote",
				"-jsconsole"
			], {
				cwd: process.cwd()
			});
		    proc.on("error", function(err) {
		    	return reject(err);
		    });
	        proc.stdout.on("data", function(data) {
	            process.stdout.write(data);
	        });
	        proc.stderr.on("data", function(data) {
	            process.stderr.write(data);
	        });
		    proc.on("exit", function(code) {
		        if (code !== 0) {
		            console.error(new Error("[it.pinf.org.mozilla.firefox] Browser stopped with error!"));
		        }
		        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Browser stopped!");
                self.stop().catch(console.error);
		    });
		    return resolve((self._process = proc));
		});
	}

	Profile.prototype.stop = function() {
		var self = this;
        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Profile.stop()");
        return new Promise(function (resolve, reject) {
			if (!self._process) {
				return resolve(null);
			}
			self._process.kill();
			// TODO: Wait for process to die.
			self._process = null;
			return resolve(true);
		});
	}

	Profile.prototype.getName = function() {
		return this._descriptor.config.profile.name;
	}

	Profile.prototype.getBrowserInstallPath = function() {
		return this._descriptor.config.browser.installPath;
	}

	Profile.prototype.getBrowserBinPath = function() {
		return this._descriptor.config.browser.binPath;
	}

	Profile.prototype.getProfilePath = function() {
		return this._profileBasePath;
	}



    if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Run firefox with config:", config);

    var router = CONNECT();
    var server = HTTP.createServer(router);
    var browserProcess = null;

    Object.keys(config.routes || {}).map(function (route) {
        var app = CODEBLOCK.run(config.routes[route], {
            API: {
                stop: stopServer
            }
        }, {
            sandbox: {
                process: process,
                console: console
            }
        });
        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Register app at route:", route, app);
        router.use(route, app);
    });

    server.listen(PORT, "127.0.0.1");
    function stopServer () {
        if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] Stop server");
        return new Promise(function (resolve, reject) {
            if (
                !server ||
                !browserProcess
            ) {
                return resolve(null);
            }
            browserProcess.kill();
            browserProcess = null;
            server.close(function () {
                resolve(null);
            });
            server.unref();
            server = null;
            process.exit(0);
        });
    }

    if (VERBOSE) console.log("[it.pinf.org.mozilla.firefox] (pid: " + process.pid + ") Server running at: http://127.0.0.1:" + PORT + "/");



    var profile = new Profile(config);
    return profile.init().then(function () {
        return profile.start().then(function (process) {
            browserProcess = process;
            return null;
        });
    }).then(function () {
        return {
            stop: stopServer
        };
    });
}
