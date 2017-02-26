"use strict";

module.exports = class Resetter
{
    constructor(core)
    {
        this.core = core;
    }

    hardResetCore()
    {
        for(let name in Game.creeps)
            Game.creeps[name].suicide();

        this.core.resetAllServices();

        this.core.createActor("ActorTickExpander");

        for(let roomName in Game.rooms)
        {
            let room = Game.rooms[roomName];

            let sites = room.find(FIND_CONSTRUCTION_SITES);
            for(let index in sites)
                sites[index].remove();

            if(room.find(FIND_MY_SPAWNS).length === 0)
                continue;

            this.core.createActor(ACTOR_NAMES.ROOM_BOOTER,(script)=>script.initiateActor(roomName));
        }
    }
};