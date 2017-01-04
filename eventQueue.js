"use strict";

module.exports = class EventQueue
{
    rewindCore()
    {
        this.queue = ["lazyProcesses", "everyTick"];
    }

    frontLoad(item)
    {
        this.queue.push(item);
    }

    rearLoad(item)
    {
        this.queue.unshift(item);
    }

    next()
    {
        if(this.queue.length === 0)
            return null;

        return this.queue.pop();
    }
};