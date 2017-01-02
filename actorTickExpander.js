"use strict";

module.exports = function(objectStore)
{
    this.eventQueue = objectStore.eventQueue;
    this.subscriptions = objectStore.subscriptions;

    this.rewind = function(actorId)
    {
        this.actorId = actorId;
    };

    this.init = function()
    {
        this.subscriptions.subscribe("everyTick", this.actorId, "everyTick");
    };

    this.unwind = function(){};
    this.remove = function(){};

    this.everyTick = function(event)
    {
        let tick = Game.time;
        let counter = 1;

        for(let mod=2; tick % mod === 0; mod *= 2)
            this.eventQueue.frontLoad("tick2pow" + counter++);
    };

    return this;
};