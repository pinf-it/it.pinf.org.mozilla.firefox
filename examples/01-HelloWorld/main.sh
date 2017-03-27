#!/usr/bin/env bash.origin.script

depend {
    "firefox": {
        "@../..#s1": {
        }
    }
}


echo "TEST_MATCH_IGNORE>>>"

#if [ ! -z "$CI" ]; then
    #echo "Start Xvfb display"
    # @see https://github.com/electron/electron/blob/master/docs/tutorial/testing-on-headless-ci.md
    # @see https://circleci.com/docs/1.0/browser-debugging/
    # http://unix.stackexchange.com/questions/9107/how-can-i-run-firefox-on-linux-headlessly-i-e-without-requiring-libgtk-x11-2-0

    #Xvfb :19 -screen 0 1024x768x16 &
    #export DISPLAY=:19

    # TODO: This NodeJS server is not queryable for some reason when running on Circle CI.
    #       Fix this for Circle CI.
#fi

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
