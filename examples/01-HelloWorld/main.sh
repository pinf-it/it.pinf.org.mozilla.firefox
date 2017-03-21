#!/usr/bin/env bash.origin.script

depend {
    "firefox": {
        "@../..#s1": {
        }
    }
}


echo "TEST_MATCH_IGNORE>>>"
CALL_firefox run {
    "homepage": "/",
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
                res.end('<html><script src="/done"></script></html>');
            };
        }
    }
}
echo "<<<TEST_MATCH_IGNORE"


echo "OK"
