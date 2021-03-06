"use strict";

const maxSteps = 10;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorProcedualCreep extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.mapNavigation = locator.getService(SERVICE_NAMES.MAP_NAVIGATION);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.logger = locator.getService(SERVICE_NAMES.LOGGER);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
		this.creepActions = locator.getService(SERVICE_NAMES.CREEP_ACTIONS);
	}

	initiateActor(creepNamePrefix, callbackStamp, instructions)
	{
		this.memoryObject =
			{ creepName: creepNamePrefix + this.actorId
			, pointer: 0
			, instructions: instructions
			, callbackStamp: callbackStamp
			};

		this.events.subscribe("everyTick", this.actorId, "onEveryTick");
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
		let creep = this.screepsApi.getCreep(this.memoryObject.creepName);
		if(creep)
			creep.suicide();

		this.events.unsubscribe("everyTick", this.actorId);
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

		return this.screepsApi.getCreep(this.memoryObject.creepName);
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

					let spawn = this.screepsApi.getObjectById(currentInstruction[1][0]); //should accept multiple spawns

					if(spawn.canCreateCreep(currentInstruction[2], this.memoryObject.creepName) !== OK)
					{
						stop = true;
						break;
					}

					spawn.createCreep(currentInstruction[2], this.memoryObject.creepName);
					break;

				case CREEP_INSTRUCTION.CALLBACK:
					let callbackActor = this.actors.get(currentInstruction[1]);
					if(callbackActor && callbackActor[currentInstruction[2]])
						callbackActor[currentInstruction[2]](this.memoryObject.callbackStamp, this.actorId);
					else
						this.logger.warning("actorProcedualCreep: callback did not exist. ID: " +
							currentInstruction[1] + " function: " + currentInstruction[2]);
					break;

				case CREEP_INSTRUCTION.MINE_UNTIL_FULL:
					creep = this.getCreep(creep);

					if(!creep || _.sum(creep.carry) === creep.carryCapacity)
						break;

					stop = true;

					source = this.screepsApi.getObjectById(currentInstruction[1]);

					if(creep.harvest(source) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.memoryObject.creepName, [source.pos.x, source.pos.y, source.pos.roomName]);

					break;

				case CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY:
					creep = this.getCreep(creep);

					if(!creep || _.sum(creep.carry) === 0)
						break;

					let controller = this.screepsApi.getObjectById(currentInstruction[1]);

					if(creep.upgradeController(controller) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.memoryObject.creepName, [controller.pos.x, controller.pos.y, controller.pos.roomName]);

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
					this.actors.remove(this.actorId);
					break;

				case CREEP_INSTRUCTION.PICKUP_AT_POS:

					creep = this.getCreep(creep);

					if(!creep)
						break;

					carrySum = _.sum(creep.carry);

					if(carrySum === creep.carryCapacity)
						break;

					posList = currentInstruction[1];
					pos = this.screepsApi.getRoomPosition(posList);


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
					//	 take loose resource if any
					//	 else take container content if it would still leave limit behind
					//else
					//	take loose resource if it would still leave limit behind.

					if(struct !== null)
					{
						if(indexOfResourceTypeInPool !== null &&
							resourceList[indexOfResourceTypeInPool].amount + carrySum >= creep.carryCapacity)
						{
							if(creep.pickup(resourceList[indexOfResourceTypeInPool]) === ERR_NOT_IN_RANGE)
								this.creepActions.moveTo(this.memoryObject.creepName, [resourceList[indexOfResourceTypeInPool].pos.x, resourceList[indexOfResourceTypeInPool].pos.y, resourceList[indexOfResourceTypeInPool].pos.roomName]);

							stop = true;
						}
						else
						{
							let stored = getStoredOfTypeFromStruct(struct, currentInstruction[2]);

							if(stored - (creep.carryCapacity - carrySum) >= limit)
							{
								if(creep.withdraw(struct, currentInstruction[2]) === ERR_NOT_IN_RANGE)
									this.creepActions.moveTo(this.memoryObject.creepName, [struct.pos.x, struct.pos.y, struct.pos.roomName]);

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
								this.creepActions.moveTo(this.memoryObject.creepName, [resourceList[indexOfResourceTypeInPool].pos.x, resourceList[indexOfResourceTypeInPool].pos.y, resourceList[indexOfResourceTypeInPool].pos.roomName]);
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
						pos = this.screepsApi.getRoomPosition(posList);

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
									this.creepActions.moveTo(this.memoryObject.creepName, [resourceList[indexOfResourceTypeInPool].pos.x, resourceList[indexOfResourceTypeInPool].pos.y, resourceList[indexOfResourceTypeInPool].pos.roomName]);

								stop = true;
							}
							else
							{
								let stored = getStoredOfTypeFromStruct(struct, currentInstruction[2]);

								if(stored - (creep.carryCapacity - carrySum) >= limit)
								{
									if(creep.withdraw(struct, currentInstruction[2]) === ERR_NOT_IN_RANGE)
										this.creepActions.moveTo(this.memoryObject.creepName, [struct.pos.x, struct.pos.y, struct.pos.roomName]);

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
									this.creepActions.moveTo(this.memoryObject.creepName, [resourceList[indexOfResourceTypeInPool].pos.x, resourceList[indexOfResourceTypeInPool].pos.y, resourceList[indexOfResourceTypeInPool].pos.roomName]);

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
					pos = this.screepsApi.getRoomPosition(posArr);

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
						this.creepActions.moveTo(this.memoryObject.creepName, [sites[0].pos.x, sites[0].pos.y, sites[0].pos.roomName]);

					break;

				case CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT:

					creep = this.getCreep(creep);

					if(!creep)
						break;

					let posInst = currentInstruction[1];
					pos = this.screepsApi.getRoomPosition(posInst);

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
					targetPos = this.screepsApi.getRoomPosition(pos);

					if(creep.pos.x === targetPos.x &&
						creep.pos.y === targetPos.y &&
						creep.pos.roomName === targetPos.roomName
					)
						break;

					stop = true;

					if(creep.pos.getRangeTo(targetPos) === 1)
					{
						let others = targetPos.lookFor(LOOK_CREEPS);
						if(others.length === 1)
							if(others[0].my === true)
								others[0].suicide();
					}

					this.creepActions.moveTo(this.memoryObject.creepName, [targetPos.x, targetPos.y, targetPos.roomName]);

					break;

				case CREEP_INSTRUCTION.MINE_UNTIL_DEATH:
					creep = this.getCreep(creep);

					if(!creep)
						break;

					source = this.screepsApi.getObjectById(currentInstruction[1]);

					if(creep.harvest(source) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.memoryObject.creepName, [source.pos.x, source.pos.y, source.pos.roomName]);

					stop = true;
					break;

				case CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY:

					creep = this.getCreep(creep);

					if(!creep || _.sum(creep.carry) === 0)
						break;

					let candidates = [];

					currentInstruction[2].forEach((targetId) =>
					{
						let candidate = this.screepsApi.getObjectById(targetId);

						if(candidate && candidate.energy !== candidate.energyCapacity)
							candidates.push(candidate);
					});

					if(candidates.length === 0)
						break;

					stop = true;

					target = creep.pos.findClosestByPath(candidates);

					if(creep.transfer(target, currentInstruction[1]) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.memoryObject.creepName, [target.pos.x, target.pos.y, target.pos.roomName]);

					break;

				case CREEP_INSTRUCTION.DEPOSIT_AT:

					creep = this.getCreep(creep);

					if(!creep || _.sum(creep.carry) === 0)
						break;

					stop = true;

					pos = currentInstruction[1];
					targetPos = this.screepsApi.getRoomPosition(pos);

					structures = targetPos.lookFor(LOOK_STRUCTURES);

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
										this.creepActions.moveTo(this.memoryObject.creepName, [targetPos.x, targetPos.y, targetPos.roomName]);
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
						this.creepActions.moveTo(this.memoryObject.creepName, [targetPos.x, targetPos.y, targetPos.roomName]);
					else
						creep.drop(currentInstruction[2]);

					break;

				case CREEP_INSTRUCTION.DISMANTLE_AT:

					creep = this.getCreep(creep);

					if(!creep)
						break;

					if(creep.hits !== creep.hitsMax)
						creep.heal(creep);

					targetPos = this.screepsApi.getRoomPosition(currentInstruction[1]);

					if(creep.pos.roomName !== targetPos.roomName)
					{
						this.creepActions.moveTo(this.memoryObject.creepName, [targetPos.x, targetPos.y, targetPos.roomName]);
						stop = true;
						break;
					}

					let targets = targetPos.lookFor(LOOK_STRUCTURES);

					if(targets.length === 0)
						break;

					stop = true;

					target = targets[0];

					if(creep.dismantle(target) !== OK)
						this.creepActions.moveTo(this.memoryObject.creepName, [target.pos.x, target.pos.y, target.pos.roomName]);

					break;

				case CREEP_INSTRUCTION.FIX_AT:

					creep = this.getCreep(creep);

					if(!creep || _.sum(creep.carry) === 0)
						break;

					pos = this.screepsApi.getRoomPosition(currentInstruction[1]);

					filteredStructs = _.filter(pos.lookFor(LOOK_STRUCTURES),
										(s)=>s.structureType === currentInstruction[2]);

					if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
						break;

					stop = true;

					if(creep.repair(filteredStructs[0]) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.memoryObject.creepName, [filteredStructs[0].pos.x, filteredStructs[0].pos.y, filteredStructs[0].pos.roomName]);

					break;

				case CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED:
					creep = this.getCreep(creep);

					if(!creep)
						break;

					pos = this.screepsApi.getRoomPosition(currentInstruction[1]);

					filteredStructs = _.filter(pos.lookFor(LOOK_STRUCTURES),
										(s)=>s.structureType === currentInstruction[2]);

					if(filteredStructs.length === 0 || filteredStructs[0].hits === filteredStructs[0].hitsMax)
						break;

					this.memoryObject.pointer = currentInstruction[3] - 1;

					break;

				case CREEP_INSTRUCTION.REMOVE_FLAG_AT:

					if(! this.screepsApi.getRoom(currentInstruction[1][2] ) )
						break;

					pos = this.screepsApi.getRoomPosition(currentInstruction[1]);

					let flags = pos.lookFor(LOOK_FLAGS);

					if(flags.length !== 0)
						flags[0].remove();

					break;

				case CREEP_INSTRUCTION.CLAIM_AT:

					creep = this.getCreep(creep);

					if(!creep)
						break;

					stop = true;

					room = this.screepsApi.getRoom(currentInstruction[1][2]);

					if(typeof room === UNDEFINED)
					{
						pos = this.screepsApi.getRoomPosition(currentInstruction[1]);
						this.creepActions.moveTo(this.memoryObject.creepName, [pos.x, pos.y, pos.roomName]);
						break;
					}

					if(creep.claimController(room.controller) !== OK)
						this.creepActions.moveTo(this.memoryObject.creepName, [room.controller.pos.x, room.controller.pos.y, room.controller.pos.roomName]);

					break;

				case CREEP_INSTRUCTION.MOVE_TO_ROOM:

					creep = this.getCreep(creep);

					if(!creep ||
						(creep.room.name === currentInstruction[1] &&
						creep.pos.x !== 0 && creep.pos.y !== 0 && creep.pos.x !== 49 && creep.pos.y !== 49))
						break;

					let roomPath;

					if(currentInstruction.length >= 2 && currentInstruction[2] === true)
						roomPath = this.mapNavigation.findSafePath(creep.room.name, currentInstruction[1]);
					else
						roomPath = this.mapNavigation.findPath(creep.room.name, currentInstruction[1]);

					if(roomPath === null || roomPath.length === 0)
						if(creep.pos.x !== 0 && creep.pos.y !== 0 && creep.pos.x !== 49 && creep.pos.y !== 49)
							break;
						else
							roomPath = [currentInstruction[1]];

					stop = true;

					if(creep.room.name === currentInstruction[1])
					{
						this.creepActions.moveTo(this.memoryObject.creepName, [25, 25, roomPath[0]]);
						break;
					}

					let exitDir = Game.map.findExit(creep.room, roomPath[0]);
					let exit = creep.pos.findClosestByRange(exitDir);
					this.creepActions.moveTo(this.memoryObject.creepName, [exit.x, exit.y, exit.roomName]);
					break;

				case CREEP_INSTRUCTION.WAIT_UNTIL_DEATH:

					creep = this.getCreep(creep);

					if(creep)
						stop = true;

					break;

				case CREEP_INSTRUCTION.GOTO_IF_TTL_LESS:

					creep = this.getCreep(creep);

					if(!creep || creep.spawning || creep.ticksToLive >= currentInstruction[2])
						break;

					//easier to subtract 1 than set a flag to not increase by 1 at end of loop
					this.memoryObject.pointer = currentInstruction[1]-1;

					break;

				case CREEP_INSTRUCTION.GOTO_IF_CREEP_EMPTY:

					creep = this.getCreep(creep);

					if(!creep || creep.spawning || _.sum(creep.carry) !== 0)
						break;

					//easier to subtract 1 than set a flag to not increase by 1 at end of loop
					this.memoryObject.pointer = currentInstruction[1]-1;

					break;

				default:
					this.logger.warning("actorProcedualCreep doesn't have a case called: " + currentInstruction[0]);
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
	}
};