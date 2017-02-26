"use strict";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorStructureEvents extends ActorWithMemory
{
    constructor(core)
    {
        super(core);
    }

    initiateActor()
    {
        super.initiateActor();
        this.core.subscribe("everyTick", this.actorId, "onEveryTick");
        this.memoryObject =
            { structures: {}
            };
    }

    removeActor()
    {
        this.core.unsubscribe("everyTick", this.actorId);
        super.removeActor();
    }

    onEveryTick(event)
    {
        let newStructureIds = Object.keys(Game.structures);
        for(let idIndex in newStructureIds)
        {
            let newStructureId = newStructureIds[idIndex];

            if(this.memoryObject.structures[newStructureId])
                continue;

            this.core.frontLoadEvent(EVENTS.STRUCTURE_BUILD + newStructureId);
            this.memoryObject.structures[newStructureId] = true;
        }

        let oldStructureIds = Object.keys(this.memoryObject.structures);
        for(let idIndex in oldStructureIds)
        {
            let oldStructureId = oldStructureIds[idIndex];

            if(Game.structures[oldStructureId])
                continue;

            this.core.frontLoadEvent(EVENTS.STRUCTURE_DESTROYED + oldStructureId);
            delete this.memoryObject.structures[oldStructureId];
        }

    }
};