#!/usr/bin/env bash.origin.script

depend {
    "firefox": {
        "@../..#s1": {
        }
    }
}

echo "OK"

return

CALL_firefox run {
    "homepage": "/",
    "extensions": {
        "test.extension@firefox.mozilla.org.pinf.it": "$__DIRNAME__/../../lib/test.extension"
    },
    "preferences": {
        "extensions.it.pinf.org.mozilla.firefox.test.extension.done.uri": "/done"
    },
    "routes": {
        "/done": function /* CodeBlock */ (API) {
            return function (req, res, next) {
                API.stop();
                res.writeHead(200);
                res.end("");
            };
        },
        "/": function /* CodeBlock */ () {
            return function (req, res, next) {
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.end('<html></html>');
            };
        }
    }
}

echo "OK"
