#!/usr/bin/env bash.origin.script

function EXPORTS_run {
    BO_run_recent_node --eval '
        const PROCESS = require("$__DIRNAME__/lib/firefox");
        PROCESS.run(JSON.parse(process.argv[1])).catch(function (err) {
            console.error("[it.pinf.org.mozilla.firefox] ERROR:", err.stack);
        });
    ' "$1"
}
