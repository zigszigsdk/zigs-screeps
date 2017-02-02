"use strict";

const ActorWithMemory = require('ActorWithMemory');
const NO_CONTROLLER_IN_ROOM = -1;

module.exports = class ActorTickExpander extends ActorWithMemory
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
            { roomLevels: {}
            };
    }

    removeActor()
    {
        this.core.unsubscribe("everyTick", this.actorId);
        super.removeActor();
    }

    onEveryTick(event)
    {
        let tick = Game.time;
        let counter = 1;

        for(let mod=2; tick % mod === 0; mod *= 2)
            this.core.frontLoadEvent("tick2pow" + counter++);

        for(let roomName in Game.rooms)
        {
            let oldRoomLevel = this.memoryObject.roomLevels[roomName];

            let room = Game.rooms[roomName];
            let currentRoomLevel = room.controller ? room.controller.level : NO_CONTROLLER_IN_ROOM;

            if(typeof oldRoomLevel === UNDEFINED || oldRoomLevel !== currentRoomLevel)
            {
                this.memoryObject.roomLevels[roomName] = currentRoomLevel;
                this.core.frontLoadEvent(EVENTS.ROOM_LEVEL_CHANGED + roomName);
            }
        }
    }
};