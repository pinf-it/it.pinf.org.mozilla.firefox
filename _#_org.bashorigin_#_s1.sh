#!/usr/bin/env bash.origin.script

if [ ! -e "$__DIRNAME__/node_modules" ]; then
    pushd "$__DIRNAME__" > /dev/null
        BO_run_npm install
    popd > /dev/null
fi


function EXPORTS_run {
    BO_run_node --eval '
        const PROCESS = require("$__DIRNAME__/lib/firefox");
        PROCESS.run(JSON.parse(process.argv[1])).catch(console.error);
    ' "$1"
}