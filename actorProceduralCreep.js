"use strict";

const maxSteps = 10;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorProcedualCreep extends ActorWithMemory
{
    constructor(core)
    {
        super(core);
        this.mapNavigation = core.getService(SERVICE_NAMES.MAP_NAVIGATION);
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

    resetActor()
    {
        let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

        let creepNamePrefix = oldMemory.creepName.substring(0, oldMemory.creepName.length - (this.actorId + "").length);

        this.initiateActor(creepNamePrefix, oldMemory.callbackStamp, oldMemory.instructions);

        //don't copy over pointer. behaviour should start over from the top.
    }

    removeActor()
    {
        let creep = this.core.getCreep(this.memoryObject.creepName);
        if(creep)
            creep.suicide();

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

        return this.core.getCreep(this.memoryObject.creepName);
    }

    replaceInstruction(index, instruction)
    {
        this.memoryObject.instructions[index] = instruction;
    }

    replaceInstructions(instructions)
    {
        this.memoryObject.instructions = instructions;
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
        let getStoredOfTypeFromStruct = function(struct, resourceType)
        {
            switch(struct.structureType)
            {
                case STRUCTURE_SPAWN:
                case STRUCTURE_EXTENSION:
                case STRUCTURE_LINK:
                case STRUCTURE_TOWER:
                    if(resourceType !== RESOURCE_ENERGY)
                        return 0;
                    return struct.energy;

                case STRUCTURE_STORAGE:
                case STRUCTURE_CONTAINER:
                case STRUCTURE_TERMINAL:
                    let result = struct.store[resourceType];
                    if(isUndefinedOrNull(result))
                        return 0;
                    return result;

                case STRUCTURE_POWER_SPAWN:
                    if(resourceType === RESOURCE_ENERGY)
                        return struct.energy;
                    if(resourceType === RESOURCE_POWER)
                        return struct.power;
                    return 0;

                case STRUCTURE_LAB:
                    if(resourceType === RESOURCE_ENERGY)
                        return struct.energy;
                    if(resourceType === struct.mineralType)
                        return struct.mineralAmount;
                    return 0;

                case STRUCTURE_NUKER:
                    if(resourceType === RESOURCE_ENERGY)
                        return struct.energy;
                    if(resourceType === RESOURCE_GHODIUM)
                        return struct.ghodium;
                    return 0;

                default:
                    return 0;
            }
        };

        let steps = 0;

        let startingPointer = this.memoryObject.pointer;

        for(let stop = false; steps < maxSteps && !stop; steps++)
        {
            let currentInstruction = this.memoryObject.instructions[this.memoryObject.pointer];

            //switch cases share scope. Can't use the same let-variable name without doing this.
            let creep;
            let pos;
            let source;
            let structs;
            let targetPos;
            let target;
            let filteredStructs;
            let filter;
            let room;
            let structures;
            let carrySum;
            let posList;
            let limit;
            let resourceList;
            let indexOfResourceTypeInPool;
            let struct;

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
                        callbackActor[currentInstruction[2]](this.memoryObject.callbackStamp, this.actorId);
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

                    if(!creep)
                        break;

                    carrySum = _.sum(creep.carry);

                    if(carrySum === creep.carryCapacity)
                        break;

                    posList = currentInstruction[1];
                    pos = this.core.getRoomPosition(posList);


                    limit = 0;
                    if(currentInstruction.length >= 4)
                        limit = currentInstruction[3];

                    resourceList = pos.lookFor(LOOK_RESOURCES);
                    indexOfResourceTypeInPool = null;

                    for(let index in resourceList)
                        if(resourceList[index].resourceType === currentInstruction[2])
                        {
                            indexOfResourceTypeInPool = index;
                            break;
                        }

                    structures = pos.lookFor(LOOK_STRUCTURES);
                    struct = null;
                    for(let index in structures)
                    {
                        if(structures[index].structureType === STRUCTURE_ROAD ||
                            structures[index].structureType === STRUCTURE_RAMPART)
                            continue;

                        struct = structures[index];
                        break;
                    }

                    //the following summerized
                    //if container
                    //     take loose resource if any
                    //     else take container content if it would still leave limit behind
                    //else
                    //    take loose resource if it would still leave limit behind.

                    if(struct !== null)
                    {
                        if(indexOfResourceTypeInPool !== null &&
                            resourceList[indexOfResourceTypeInPool].amount + carrySum >= creep.carryCapacity)
                        {
                            if(creep.pickup(resourceList[indexOfResourceTypeInPool]) === ERR_NOT_IN_RANGE)
                                creep.moveTo(resourceList[indexOfResourceTypeInPool]);

                            stop = true;
                        }
                        else
                        {
                            let stored = getStoredOfTypeFromStruct(struct, currentInstruction[2]);

                            if(stored - (creep.carryCapacity - carrySum) >= limit)
                            {
                                if(creep.withdraw(struct, currentInstruction[2]) === ERR_NOT_IN_RANGE)
                                    creep.moveTo(struct);

                                stop = true;
                            }
                        }
                    }
                    else
                    {
                        if(indexOfResourceTypeInPool !== null &&
                            resourceList[indexOfResourceTypeInPool].amount - (creep.carryCapacity - carrySum) >= limit)
                        {
                            if(creep.pickup(resourceList[indexOfResourceTypeInPool]) === ERR_NOT_IN_RANGE)
                                creep.moveTo(resourceList[indexOfResourceTypeInPool]);

                            stop = true;
                        }
                    }

                    break;

                case CREEP_INSTRUCTION.PICKUP_AT_NEAREST:

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    carrySum = _.sum(creep.carry);

                    if(carrySum === creep.carryCapacity)
                        break;
                    let positions = currentInstruction[1];

                    //ascending
                    positions.sort((a,b)=>creep.pos.getRangeTo(a[0], a[1]) - creep.pos.getRangeTo(b[0], b[1]));

                    for(let positionIndex in positions)
                    {
                        posList = positions[positionIndex];
                        pos = this.core.getRoomPosition(posList);

                        limit = 0;
                        if(currentInstruction.length >= 4)
                            limit = currentInstruction[3];

                        resourceList = pos.lookFor(LOOK_RESOURCES);
                        indexOfResourceTypeInPool = null;

                        for(let index in resourceList)
                            if(resourceList[index].resourceType === currentInstruction[2])
                            {
                                indexOfResourceTypeInPool = index;
                                break;
                            }

                        structures = pos.lookFor(LOOK_STRUCTURES);
                        struct = null;
                        for(let index in structures)
                        {
                            if(structures[index].structureType === STRUCTURE_ROAD ||
                                structures[index].structureType === STRUCTURE_RAMPART)
                                continue;

                            struct = structures[index];
                            break;
                        }

                        if(struct !== null)
                        {
                            if(indexOfResourceTypeInPool !== null &&
                                resourceList[indexOfResourceTypeInPool].amount + carrySum >= creep.carryCapacity)
                            {
                                if(creep.pickup(resourceList[indexOfResourceTypeInPool]) === ERR_NOT_IN_RANGE)
                                    creep.moveTo(resourceList[indexOfResourceTypeInPool]);

                                stop = true;
                            }
                            else
                            {
                                let stored = getStoredOfTypeFromStruct(struct, currentInstruction[2]);

                                if(stored - (creep.carryCapacity - carrySum) >= limit)
                                {
                                    if(creep.withdraw(struct, currentInstruction[2]) === ERR_NOT_IN_RANGE)
                                        creep.moveTo(struct);

                                    stop = true;
                                }
                            }
                        }
                        else
                        {
                            if(indexOfResourceTypeInPool !== null &&
                                resourceList[indexOfResourceTypeInPool].amount - (creep.carryCapacity - carrySum) >= limit)
                            {
                                if(creep.pickup(resourceList[indexOfResourceTypeInPool]) === ERR_NOT_IN_RANGE)
                                    creep.moveTo(resourceList[indexOfResourceTypeInPool]);

                                stop = true;
                            }
                        }
                        if(stop)
                            break;
                    }

                    break;

                case CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY:

                    creep = this.getCreep(creep);

                    if(!creep || _.sum(creep.carry) === 0)
                        break;

                    let posArr = currentInstruction[1];
                    pos = this.core.getRoomPosition(posArr);

                    if(pos.isEqualTo(creep.pos)) //most structures can't be build if you're standing on
                    {
                        creep.move(Math.floor(Math.random()*8));
                        stop = true;
                        break;
                    }

                    structs = pos.lookFor(LOOK_STRUCTURES);

                    let completed = false;
                    if(currentInstruction[2] !== STRUCTURE_ROAD && currentInstruction[2] !== STRUCTURE_RAMPART)
                        structs.forEach((struct) =>
                        {
                            if(struct.structureType === STRUCTURE_ROAD || struct.structureType === STRUCTURE_RAMPART)
                                return;

                            if(struct.structureType !== currentInstruction[2])
                                return struct.destroy();

                            completed = true;
                        });
                    else
                        structs.forEach((struct) =>
                        {
                            if(struct.structureType === currentInstruction[2])
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
                    pos = this.core.getRoomPosition(posInst);

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

                    if(!creep || isNullOrUndefined(currentInstruction[1]))
                        break;

                    pos = currentInstruction[1];
                    targetPos = this.core.getRoomPosition(pos);

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

                        if(candidate && candidate.energy !== candidate.energyCapacity)
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
                    targetPos = this.core.getRoomPosition(pos);

                    let structures = targetPos.lookFor(LOOK_STRUCTURES);

                    let breakOut = false;

                    for(let index in structures)
                    {
                        switch(structures[index].structureType)
                        {
                            case STRUCTURE_CONTAINER:
                            case STRUCTURE_SPAWN:
                            case STRUCTURE_EXTENSION:
                            case STRUCTURE_LINK:
                            case STRUCTURE_STORAGE:
                            case STRUCTURE_TOWER:
                            case STRUCTURE_POWER_SPAWN:
                            case STRUCTURE_LAB:
                            case STRUCTURE_TERMINAL:
                            case STRUCTURE_NUKER:

                                switch(creep.transfer(structures[index], currentInstruction[2]))
                                {
                                    case ERR_NOT_IN_RANGE:
                                        creep.moveTo(targetPos);
                                        break;
                                    case ERR_FULL:
                                        stop = false;
                                        break;
                                    default:
                                        break;
                                }
                                breakOut = true;
                                break;

                            default:
                                break;
                        }

                        if(breakOut)
                            break;
                    }

                    if(breakOut)
                        break;

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

                    targetPos = this.core.getRoomPosition(currentInstruction[1]);

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

                    pos = this.core.getRoomPosition(currentInstruction[1]);

                    filteredStructs = _.filter(pos.lookFor(LOOK_STRUCTURES),
                                        (s)=>(x)=>s.structureType === currentInstruction[2]);

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

                    pos = this.core.getRoomPosition(currentInstruction[1]);

                    filter = {filter: (x)=>x.structureType === currentInstruction[2]};
                    filteredStructs = pos.lookFor(LOOK_STRUCTURES, filter);

                    if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
                        break;

                    this.memoryObject.pointer = currentInstruction[3] - 1;

                    break;

                case CREEP_INSTRUCTION.REMOVE_FLAG_AT:

                    if(! this.core.getRoom(currentInstruction[1][2] ) )
                        break;

                    pos = this.core.getRoomPosition(currentInstruction[1]);

                    let flags = pos.lookFor(LOOK_FLAGS);

                    if(flags.length !== 0)
                        flags[0].remove();

                    break;

                case CREEP_INSTRUCTION.CLAIM_AT:

                    creep = this.getCreep(creep);

                    if(!creep)
                        break;

                    stop = true;

                    room = this.core.getRoom(currentInstruction[1][2]);

                    if(typeof room === UNDEFINED)
                    {
                        pos = this.core.getRoomPosition(currentInstruction[1]);
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

            if(this.memoryObject.pointer === startingPointer)
                break; //script has gone for a full loop and shouldn't take any further action until next tick.
        }

        if(steps === maxSteps)
            this.core.logWarning("aborted actorProcedualCreep (" + this.memoryObject.creepName +
                ") loop after " + steps + " steps");
    }
};