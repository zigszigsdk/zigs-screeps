"use strict";
let memoryBank;
let actors;
let logger;

module.exports = {

    build: function(objectStore)
    {
        memoryBank = objectStore.memoryBank;
        actors = objectStore.actors;
        logger = objectStore.logger;
    },

    hardReset: function()
    {
        for(let name in Game.creeps)
            Game.creeps[name].suicide();

        actors.createNew("actorTickExpander");

        for(let roomName in Game.rooms)
        {
            let room = Game.rooms[roomName];

            if(room.find(FIND_MY_SPAWNS).length === 0)
                continue;

            actors.createNew("actorRoomUpgradeStrategy", (script)=>script.init(roomName));
        }
    },
};