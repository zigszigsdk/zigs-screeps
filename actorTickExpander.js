"use strict";

module.exports = class ActorTickExpander
{
    constructor(core)
    {
        this.core = core;
    }

    rewindActor(actorId)
    {
        this.actorId = actorId;
    }

    initiateActor()
    {
        this.core.subscribe("everyTick", this.actorId, "everyTick");
    }

    unwindActor(){}

    resetActor(){}

    removeActor()
    {
        this.core.unsubscribe("everyTick", this.actorId);
    }

    everyTick(event)
    {
        let tick = Game.time;
        let counter = 1;

        for(let mod=2; tick % mod === 0; mod *= 2)
            this.core.frontLoadEvent("tick2pow" + counter++);
    }
};