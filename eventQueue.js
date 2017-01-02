
"use strict";
let queue;

module.exports =
{
    rewind: function()
    {
        queue = ["lazyProcesses", "everyTick"];
    },

    frontLoad: function(item)
    {
        queue.push(item);
    },

    rearLoad: function(item)
    {
        queue.unshift(item);
    },

    next: function()
    {
        if(queue.length === 0)
            return null;

        return queue.pop();
    },
};