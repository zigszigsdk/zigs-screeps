"use strict";

const ALIAS = "proceduralCreep";
const maxSteps = 10;

module.exports = function(objectStore)
{
    this.memoryBank = objectStore.memoryBank;
    this.subscriptions = objectStore.subscriptions;
    this.actors = objectStore.actors;
    this.logger = objectStore.logger;

    this.rewind = function(actorId)
    {
        this.actorId = actorId;
        this.bankKey = "actor:" + ALIAS + ":" + this.actorId;
        this.memoryObject = this.memoryBank.get(this.bankKey);
    };

    this.init = function(creepNamePrefix, callbackStamp, instructions)
    {
        this.subscriptions.subscribe("everyTick", this.actorId, "onEveryTick");
        this.memoryObject =
            { creepName: creepNamePrefix + this.actorId
            , pointer: 0
            , instructions: instructions
            , callbackStamp: callbackStamp
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

    this.pointerAt = function()
    {
        return this.memoryObject.pointer;
    };

    this.onEveryTick = function(event)
    {
        let steps = 0;

        for(let stop = false; steps < maxSteps && !stop; steps++)
        {
            let currentInstruction = this.memoryObject.instructions[this.memoryObject.pointer];

            //switch cases share scope. Can't use the same let-variable name without doing this. Derp.
            let creep;
            let pos;
            let source;
            let structs;
            let targetPos;
            let target;
            let filteredStructs;
            let filter;
            switch(currentInstruction[0])
            {
                case CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(creep !== null && creep !== undefined)
                        break;

                    let spawn = Game.getObjectById(currentInstruction[1][0]); //should accept multiple spawns

                    if(spawn.canCreateCreep(currentInstruction[2], this.memoryObject.creepName) !== OK)
                    {
                        stop = true;
                        break;
                    }

                    spawn.createCreep(currentInstruction[2], this.memoryObject.creepName);
                    break;

                case CREEP_INSTRUCTION.CALLBACK:
                    let callbackActor = this.actors.getFromId(currentInstruction[1]);
                    if(callbackActor && callbackActor[currentInstruction[2]])
                        callbackActor[currentInstruction[2]](this.memoryObject.callbackStamp);
                    else
                        this.logger.warning("actorProcedualCreep: callback did not exist. ID: " +
                            currentInstruction[1] + " function: " + currentInstruction[2]);
                    break;

                case CREEP_INSTRUCTION.MINE_UNTIL_FULL:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === creep.carryCapacity)
                        break;

                    stop = true;

                    source = Game.getObjectById(currentInstruction[1]);

                    if(creep.harvest(source) === ERR_NOT_IN_RANGE)
                       creep.moveTo(source);

                    break;

                case CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let controller = Game.getObjectById(currentInstruction[1]);

                    if(creep.upgradeController(controller) === ERR_NOT_IN_RANGE)
                        creep.moveTo(controller);

                    stop = true;
                    break;

                case CREEP_INSTRUCTION.GOTO_IF_ALIVE:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                    this.memoryObject.pointer = currentInstruction[1]-1;

                    break;

                case CREEP_INSTRUCTION.GOTO_IF_DEAD:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(creep)
                        break;

                    //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                    this.memoryObject.pointer = currentInstruction[1]-1;

                    break;

                case CREEP_INSTRUCTION.DESTROY_SCRIPT:
                    stop=true;
                    this.actors.removeActor(this.actorId);
                    break;

                case CREEP_INSTRUCTION.PICKUP_AT_POS:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === creep.carryCapacity)
                        break;

                    stop = true;
                    let posList = currentInstruction[1];
                    pos = new RoomPosition(posList[0], posList[1], posList[2]);

                    let energyList = pos.lookFor(currentInstruction[2]);

                    if(energyList.length !== 0)
                        if(creep.pickup(energyList[0]) === ERR_NOT_IN_RANGE)
                            creep.moveTo(energyList[0]);

                    let containers = pos.lookFor(LOOK_STRUCTURES, FILTERS.CONTAINERS);

                    if(containers.length !== 0)
                        if(creep.withdraw(containers[0], currentInstruction[2]) === ERR_NOT_IN_RANGE)
                            creep.moveTo(containers[0]);
                    break;

                case CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let posArr = currentInstruction[1];
                    pos = new RoomPosition(posArr[0], posArr[1], posArr[2]);

                    if(pos.isEqualTo(creep.pos))
                    {
                        creep.move(Math.floor(Math.random()*8));
                        stop = true;
                        break;
                    }

                    structs = pos.lookFor(LOOK_STRUCTURES);

                    let completed = false;
                    structs.forEach((struct) =>
                    {
                        if(struct.structureType === STRUCTURE_ROAD)
                            return;

                        if(struct.structureType !== currentInstruction[2])
                            return struct.destroy();

                        completed = true;
                    });

                    if(completed)
                        break;

                    stop = true;

                    let sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

                    if(sites.length === 0)
                    {
                        pos.createConstructionSite(currentInstruction[2]);
                        break;
                    }

                    if(creep.build(sites[0]) !== OK)
                        creep.moveTo(sites[0].pos);
                    break;

                case CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    let posInst = currentInstruction[1];
                    pos = new RoomPosition(posInst[0], posInst[1], posInst[2]);

                    structs = pos.lookFor(LOOK_STRUCTURES);

                    let jump = false;

                    structs.forEach((struct) =>
                    {
                        if(struct.structureType === currentInstruction[2])
                            jump = true;
                    });

                    if(jump)
                        //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                        this.memoryObject.pointer = currentInstruction[3] - 1;

                    break;

                case CREEP_INSTRUCTION.RECYCLE_CREEP:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    if(creep.spawning)
                    {
                        stop = true;
                        break;
                    }

                    creep.suicide();

                    break;

                case CREEP_INSTRUCTION.MOVE_TO_POSITION:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;
                    pos = currentInstruction[1];
                    targetPos = new RoomPosition(pos[0], pos[1], pos[2]);

                    if(creep.pos.x === targetPos.x &&
                        creep.pos.y === targetPos.y &&
                        creep.pos.roomName === targetPos.roomName
                    )
                        break;

                    stop = true;

                    let others = targetPos.lookFor(LOOK_CREEPS);

                    if(others.length === 1)
                        if(others[0].my === true)
                            others[0].suicide();

                    creep.moveTo(targetPos);
                    break;

                case CREEP_INSTRUCTION.MINE_UNTIL_DEATH:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    source = Game.getObjectById(currentInstruction[1]);

                    if(creep.harvest(source) === ERR_NOT_IN_RANGE)
                       creep.moveTo(source);

                    stop = true;
                    break;

                case CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let candidates = [];

                    currentInstruction[2].forEach((targetId) =>
                    {
                        let candidate = Game.getObjectById(targetId);

                        if(candidate.energy !== candidate.energyCapacity)
                            candidates.push(candidate);
                    });

                    if(candidates.length === 0)
                        break;

                    stop = true;

                    target = creep.pos.findClosestByPath(candidates);

                    if(creep.transfer(target, currentInstruction[1]) === ERR_NOT_IN_RANGE)
                        creep.moveTo(target);

                    break;

                case CREEP_INSTRUCTION.DEPOSIT_AT:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    stop = true;

                    pos = currentInstruction[1];
                    targetPos = new RoomPosition(pos[0], pos[1], pos[2]);

                    if(creep.pos.x !== targetPos.x ||
                        creep.pos.y !== targetPos.y ||
                        creep.pos.roomName !== targetPos.roomName
                    )
                        creep.moveTo(targetPos);
                    else
                        creep.drop(currentInstruction[2]);

                    break;

                case CREEP_INSTRUCTION.DISMANTLE_AT:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    targetPos = new RoomPosition(   currentInstruction[1][0],
                                                    currentInstruction[1][1],
                                                    currentInstruction[1][2]);

                    if(creep.pos.roomName !== targetPos.roomName)
                    {
                        creep.moveTo(targetPos);
                        stop = true;
                        break;
                    }

                    let targets = targetPos.lookFor(LOOK_STRUCTURES);

                    if(targets.length === 0)
                        break;

                    stop = true;

                    target = targets[0];

                    if(creep.dismantle(target) !== OK)
                        creep.moveTo(target);

                    break;

                case CREEP_INSTRUCTION.FIX_AT:

                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    pos = new RoomPosition(currentInstruction[1][0], currentInstruction[1][1], currentInstruction[1][2]);

                    filter = {filter: (x)=>x.structureType === currentInstruction[2]};
                    filteredStructs = pos.lookFor(LOOK_STRUCTURES, filter);

                    if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
                        break;

                    stop = true;

                    if(creep.repair(filteredStructs[0]) === ERR_NOT_IN_RANGE)
                        creep.moveTo(filteredStructs[0]);

                    break;

                case CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED:
                    creep = Game.creeps[this.memoryObject.creepName];

                    if(!creep)
                        break;

                    pos = new RoomPosition(currentInstruction[1][0], currentInstruction[1][1], currentInstruction[1][2]);

                    filter = {filter: (x)=>x.structureType === currentInstruction[2]};
                    filteredStructs = pos.lookFor(LOOK_STRUCTURES, filter);

                    if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
                        break;

                    this.memoryObject.pointer = currentInstruction[3] - 1;

                    break;

                case CREEP_INSTRUCTION.REMOVE_FLAG_AT:

                    if(! Game.rooms[currentInstruction[1][2] ] )
                        break;

                    pos = new RoomPosition(currentInstruction[1][0], currentInstruction[1][1], currentInstruction[1][2]);

                    let flags = pos.lookFor(LOOK_FLAGS);

                    if(flags.length !== 0)
                        flags[0].remove();

                    break;

                default:
                    this.logger.error("actorProcedualCreep doesn't have a case called: " + currentInstruction[0]);
                    stop = true;
                    break;
            }

            if(this.memoryObject === null) //script was destroyed this iteration
                break;


            if(stop === false)
                this.memoryObject.pointer++;
        }

        if(steps === maxSteps)
            this.logger.warning("aborted actorProcedualCreep (" + this.memoryObject.creepName +
                ") loop after " + steps + " steps");
    };
};