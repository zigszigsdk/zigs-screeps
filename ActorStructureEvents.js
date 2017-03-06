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

            let roomName = this.core.getObjectById(newStructureId).room.name;

            this.core.frontLoadEvent(EVENTS.STRUCTURE_BUILD + newStructureId);
            this.core.frontLoadEvent(EVENTS.STRUCTURE_BUILD + roomName);
            this.memoryObject.structures[newStructureId] =
                { roomName: roomName
                };
        }

        let oldStructureIds = Object.keys(this.memoryObject.structures);
        for(let idIndex in oldStructureIds)
        {
            let oldStructureId = oldStructureIds[idIndex];

            if(Game.structures[oldStructureId])
                continue;

            this.core.frontLoadEvent(EVENTS.STRUCTURE_DESTROYED + oldStructureId);
            this.core.frontLoadEvent(EVENTS.STRUCTURE_DESTROYED + this.memoryObject.structures[oldStructureId].roomName);
            delete this.memoryObject.structures[oldStructureId];
        }

    }
};