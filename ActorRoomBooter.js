"use strict";

let ActorWithMemory = require("ActorWithMemory");

module.exports = class ActorRoomBooter extends ActorWithMemory
{
    constructor(core)
    {
        super(core);
    }

    initiateActor(roomName)
    {
        this.core.subscribe(EVENTS.EVERY_TICK_LATE, this.actorId, "onEveryTickLate");
        this.memoryObject =
            { phase: 0
            , roomName: roomName};
    }

    resetActor()
    {
        this.initiateActor(this.memoryObject.roomName);
    }

    removeActor()
    {
        this.core.unsubscribe(EVENTS.EVERY_TICK_LATE, this.actorId);
        super.removeActor();
    }

    onEveryTickLate()
    {
        switch(this.memoryObject.phase)
        {
            case 0:
                let terrainCache = this.core.getService(SERVICE_NAMES.TERRAIN_CACHE);
                terrainCache.cacheRoom(this.memoryObject.roomName);
                this.memoryObject.phase++;
                break;

            case 1:
                let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
                roomScoring.scoreRoom(this.memoryObject.roomName);
                this.memoryObject.phase++;
                break;

            case 2:
                this.core.createActor(ACTOR_NAMES.CONTROLLED_ROOM,
                    (script) => script.initiateActor(this.memoryObject.roomName));
                this.memoryObject.phase++;
                break;

            case 3:
                this.core.removeActor(this.actorId);
                break;
        }
    }

};