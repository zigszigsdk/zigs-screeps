"use strict";

let core;

module.exports.loop = function()
{
    //reused cloud workers wont destroy the previous setup.
    //Reusing it will save valuable CPU

    if(! core)
    {
    	let Core = require('Core');
        core = new Core();
    }

    core.boot();
};