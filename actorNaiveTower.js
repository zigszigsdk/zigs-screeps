"use strict";

const ALIAS = "naiveTower";
const TOWER_MAX_DMG_RANGE = 5;

module.exports = function(objectStore)
{
    this.memoryBank = objectStore.memoryBank;
    this.subscriptions = objectStore.subscriptions;

    this.rewind = function(actorId)
    {
        this.actorId = actorId;
        this.bankKey = "actor:" + ALIAS + ":" + this.actorId;
        this.memoryObject = this.memoryBank.get(this.bankKey);
    };

    this.init = function(location)
    {
        this.subscriptions.subscribe("everyTick", this.actorId, "onEveryTick");
        this.memoryObject =
            { location: location
            };
    };

    this.unwind = function()
    {
        this.memoryBank.set(this.bankKey, this.memoryObject);
    };

    this.remove = function()
    {
        this.subscriptions.unsubscribe("everyTick", this.actorId);
        this.memoryBank.erase(this.bankKey);
        this.memoryObject = null;
    };

    this.onEveryTick = function()
    {
        let towerRp = new RoomPosition(this.memoryObject.location[0],
                                        this.memoryObject.location[1],
                                        this.memoryObject.location[2]);

        let structs = towerRp.lookFor(LOOK_STRUCTURES);

        if(structs.length === 0 || structs[0].structureType !== STRUCTURE_TOWER)
            return;

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
    };
};