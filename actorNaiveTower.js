"use strict";

const ALIAS = "naiveTower";
const TOWER_MAX_DMG_RANGE = 5;

module.exports = class ActorNaiveTower
{
    constructor(core)
    {
        this.core = core;
    }

    rewindActor(actorId)
    {
        this.actorId = actorId;
        this.bankKey = "actor:" + ALIAS + ":" + this.actorId;
        this.memoryObject = this.core.getMemory(this.bankKey);
    }

    initiateActor(location)
    {
        this.core.subscribe("everyTick", this.actorId, "onEveryTick");
        this.memoryObject =
            { location: location
            };
    }

    unwindActor()
    {
        this.core.setMemory(this.bankKey, this.memoryObject);
    }

    removeActor()
    {
        this.core.unsubscribe("everyTick", this.actorId);
        this.core.eraseMemory(this.bankKey);
        this.memoryObject = null;
    }

    onEveryTick()
    {
        let towerRp = new RoomPosition(this.memoryObject.location[0],
                                        this.memoryObject.location[1],
                                        this.memoryObject.location[2]);

        let structs = towerRp.lookFor(LOOK_STRUCTURES);

        if(structs.length === 0 || structs[0].structureType !== STRUCTURE_TOWER)
        {
            this.core.removeActor(this.actorId);
            return;
        }

        let room = Game.rooms[this.memoryObject.location[2]];

        let enemies = room.find(FIND_HOSTILE_CREEPS);

        if(enemies.length === 0)
            return;

        let targets = towerRp.findInRange(enemies, TOWER_MAX_DMG_RANGE);

        if(targets.length === 0)
            return;

        let tower = structs[0];

        let target = targets[Math.floor(Math.random() * targets.length)];

        tower.attack(target);
    }
};