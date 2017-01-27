"use strict";

const maxSteps = 10;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorProcedualCreep extends ActorWithMemory
{
    constructor(core)
    {
        super(core);
    }

    initiateActor(creepNamePrefix, callbackStamp, instructions)
    {
        this.memoryObject =
            { creepName: creepNamePrefix + this.actorId
            , pointer: 0
            , instructions: instructions
            , callbackStamp: callbackStamp
            };

        this.core.subscribe("everyTick", this.actorId, "onEveryTick");
        this.onEveryTick(); //act or initiation tick
    }

    removeActor()
    {
        this.core.unsubscribe("everyTick", this.actorId);
        super.removeActor();
    }

    pointerAt()
    {
        return this.memoryObject.pointer;
    }

    getCreep(creep)
    {
        if(creep)
            return creep;

        return this.core.creep(this.memoryObject.creepName);
    }

    replaceInstruction(index, instruction)
    {
        this.memoryObject.instructions[index] = instruction;
    }

    setPointer(val)
    {
        this.memoryObject.pointer = val;
    }

    getCallbackObj()
    {
        return this.memoryObject.callbackStamp;
    }

    setCallbackObj(callbackObj)
    {
        this.memoryObject.callbackStamp = callbackObj;
    }

    onEveryTick(event)
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
                    creep = this.getCreep(creep);

                    if(creep !== null && creep !== undefined)
                        break;

                    let spawn = this.core.getObjectById(currentInstruction[1][0]); //should accept multiple spawns

                    if(spawn.canCreateCreep(currentInstruction[2], this.memoryObject.creepName) !== OK)
                    {
                        stop = true;
                        break;
                    }

                    spawn.createCreep(currentInstruction[2], this.memoryObject.creepName);
                    break;

                case CREEP_INSTRUCTION.CALLBACK:
                    let callbackActor = this.core.actorFromId(currentInstruction[1]);
                    if(callbackActor && callbackActor[currentInstruction[2]])
                        callbackActor[currentInstruction[2]](this.memoryObject.callbackStamp);
                    else
                        this.core.logWarning("actorProcedualCreep: callback did not exist. ID: " +
                            currentInstruction[1] + " function: " + currentInstruction[2]);
                    break;

                case CREEP_INSTRUCTION.MINE_UNTIL_FULL:
                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === creep.carryCapacity)
                        break;

                    stop = true;

                    source = this.core.getObjectById(currentInstruction[1]);

                    if(creep.harvest(source) === ERR_NOT_IN_RANGE)
                       creep.moveTo(source);

                    break;

                case CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY:
                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let controller = this.core.getObjectById(currentInstruction[1]);

                    if(creep.upgradeController(controller) === ERR_NOT_IN_RANGE)
                        creep.moveTo(controller);

                    stop = true;
                    break;

                case CREEP_INSTRUCTION.GOTO_IF_ALIVE:
                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                    this.memoryObject.pointer = currentInstruction[1]-1;

                    break;

                case CREEP_INSTRUCTION.GOTO_IF_DEAD:
                    creep = this.getCreep(creep);

                    if(creep)
                        break;

                    //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                    this.memoryObject.pointer = currentInstruction[1]-1;

                    break;

                case CREEP_INSTRUCTION.GOTO:
                    //easier to subtract 1 than set a flag to not increase by 1 at end of loop
                    this.memoryObject.pointer = currentInstruction[1]-1;
                    break;

                case CREEP_INSTRUCTION.DESTROY_SCRIPT:
                    stop=true;
                    this.core.removeActor(this.actorId);
                    break;

                case CREEP_INSTRUCTION.PICKUP_AT_POS:

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === creep.carryCapacity)
                        break;

                    stop = true;
                    let posList = currentInstruction[1];
                    pos = this.core.roomPosition(posList[0], posList[1], posList[2]);

                    let energyList = pos.lookFor(currentInstruction[2]);
                    let limit = 0;

                    if(currentInstruction.length >= 4)
                        limit = currentInstruction[3];

                    if(energyList.length !== 0)
                    {
                        if(energyList[0].amount < limit)
                            break;

                        if(creep.pickup(energyList[0]) === ERR_NOT_IN_RANGE)
                            creep.moveTo(energyList[0]);

                        break;
                    }
                    let containers = pos.lookFor(LOOK_STRUCTURES, FILTERS.CONTAINERS);

                    if(containers.length === 0 || containers[0].store[currentInstruction[2]] < limit)
                        break;

                    if(creep.withdraw(containers[0], currentInstruction[2]) === ERR_NOT_IN_RANGE)
                        creep.moveTo(containers[0]);

                    break;

                case CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY:

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let posArr = currentInstruction[1];
                    pos = this.core.roomPosition(posArr[0], posArr[1], posArr[2]);

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

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    let posInst = currentInstruction[1];
                    pos = this.core.roomPosition(posInst[0], posInst[1], posInst[2]);

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

                    creep = this.getCreep(creep);

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

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;
                    pos = currentInstruction[1];
                    targetPos = this.core.roomPosition(pos[0], pos[1], pos[2]);

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
                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    source = this.core.getObjectById(currentInstruction[1]);

                    if(creep.harvest(source) === ERR_NOT_IN_RANGE)
                       creep.moveTo(source);

                    stop = true;
                    break;

                case CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY:

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let candidates = [];

                    currentInstruction[2].forEach((targetId) =>
                    {
                        let candidate = this.core.getObjectById(targetId);

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

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    stop = true;

                    pos = currentInstruction[1];
                    targetPos = this.core.roomPosition(pos[0], pos[1], pos[2]);

                    if(creep.pos.x !== targetPos.x ||
                        creep.pos.y !== targetPos.y ||
                        creep.pos.roomName !== targetPos.roomName
                    )
                        creep.moveTo(targetPos);
                    else
                        creep.drop(currentInstruction[2]);

                    break;

                case CREEP_INSTRUCTION.DISMANTLE_AT:

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    if(creep.hits !== creep.hitsMax)
                        creep.heal(creep);

                    targetPos = this.core.roomPosition( currentInstruction[1][0],
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
                        creep.moveTo(target, {maxRooms: 4});

                    break;

                case CREEP_INSTRUCTION.FIX_AT:

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    pos = this.core.roomPosition(currentInstruction[1][0],
                        currentInstruction[1][1], currentInstruction[1][2]);

                    filter = {filter: (x)=>x.structureType === currentInstruction[2]};
                    filteredStructs = pos.lookFor(LOOK_STRUCTURES, filter);

                    if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
                        break;

                    stop = true;

                    if(creep.repair(filteredStructs[0]) === ERR_NOT_IN_RANGE)
                        creep.moveTo(filteredStructs[0]);

                    break;

                case CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED:
                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    pos = this.core.roomPosition(currentInstruction[1][0],
                        currentInstruction[1][1], currentInstruction[1][2]);

                    filter = {filter: (x)=>x.structureType === currentInstruction[2]};
                    filteredStructs = pos.lookFor(LOOK_STRUCTURES, filter);

                    if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
                        break;

                    this.memoryObject.pointer = currentInstruction[3] - 1;

                    break;

                case CREEP_INSTRUCTION.REMOVE_FLAG_AT:

                    if(! this.core.room(currentInstruction[1][2] ) )
                        break;

                    pos = this.core.roomPosition(currentInstruction[1][0],
                        currentInstruction[1][1], currentInstruction[1][2]);

                    let flags = pos.lookFor(LOOK_FLAGS);

                    if(flags.length !== 0)
                        flags[0].remove();

                    break;

                case CREEP_INSTRUCTION.CLAIM_AT:

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    stop = true;

                    let room = this.core.room(currentInstruction[1][2]);

                    if(typeof room === UNDEFINED)
                    {
                        pos = this.core.roomPosition(
                            currentInstruction[1][0],
                            currentInstruction[1][1],
                            currentInstruction[1][2]);
                        creep.moveTo(pos);
                        break;
                    }

                    if(creep.claimController(room.controller) !== OK)
                        creep.moveTo(room.controller);

                    break;

                default:
                    this.core.logWarning("actorProcedualCreep doesn't have a case called: " + currentInstruction[0]);
                    stop = true;
                    break;
            }

            if(this.memoryObject === null) //script was destroyed this iteration
                break;


            if(stop === false)
                this.memoryObject.pointer++;
        }

        if(steps === maxSteps)
            this.core.logWarning("aborted actorProcedualCreep (" + this.memoryObject.creepName +
                ") loop after " + steps + " steps");
    }
};