"use strict";

let ActorWithMemory = require('ActorWithMemory');

const TARGET_WORKPARTS = 20;

const MAX_CREEPS_OVER_LEVEL = [0, 1, 3, 3, 3, 3, 3, 3, 3];
const TARGET_RESOURCE_RESERVE = 1500;

module.exports = class ActorRoomUpgrade extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);

		this.roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
	}

	initiateActor(parentId, roomName)
	{
		let score = this.roomScoring.getRoom(roomName);
		let parkingSpots = score.upgrade.spots;
		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, workParts: 0
			, creepCount: 0
			, energyPos: score.upgrade.container
			, parking:
				{ spots: parkingSpots
				, actors: Array(parkingSpots.length)
				}
			, controllerId: this.core.getRoom(roomName).controller.id
			};
	}

	lateInitiate()
	{

		let parent = this.core.getActor(this.memoryObject.parentId);


		parent.requestBuilding(	[STRUCTURE_CONTAINER, STRUCTURE_LINK],
								this.memoryObject.energyPos,
								PRIORITY_NAMES.BUILD.UPGRADER_CONTAINER,
								2);

		let request = new this.ResourceRequest(this.memoryObject.energyPos, RESOURCE_ENERGY)
					.setPriorityName(PRIORITY_NAMES.RESOURCE.UPGRADE)
					.setRate(-15)
					.setDesired(TARGET_RESOURCE_RESERVE)
					.setMin(250)
					.fabricate();

		parent.requestResource(request);

		this.requestCreep();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		let oldActors = [];
		for(let index in oldMemory.parking.actor)
			if(!isNullOrUndefined(oldMemory.parking.actor[index]))
				oldActors.push(oldMemory.parking.actor[index]);

		for(let index = 0; index < this.memoryObject.parking.spots.length && oldActors.length > 0; index++)
			this.memoryObject.parking.actors[index] = oldActors.pop();

		for(let index in oldActors)
			this.core.getActor(oldActors[index]).setPointer(5); //destroy self and report to this script

		//these two will be adjusted automatically by the actors calling back on death.
		this.memoryObject.creepCount = oldMemory.creepCount;
		this.memoryObject.workParts = oldMemory.workParts;

		this.lateInitiate();
	}

	requestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createUpgrader"
			, priority: PRIORITY_NAMES.SPAWN.UPGRADER
			, energyNeeded: 2000
			});
	}

	createUpgrader(spawnId)
	{
		if(this.memoryObject.workParts >= TARGET_WORKPARTS)
			return;

		let room = this.core.getRoom(this.memoryObject.roomName);
		let energy = room.energyCapacityAvailable;

		let body = new this.CreepBodyFactory()
			.addPattern([CARRY, WORK, WORK, MOVE], 1)
			.addPattern(Array(2).fill(WORK), 1)
			.addPattern([MOVE], 3)
			.addPattern(Array(1).fill(WORK), 1)
			.addPattern([MOVE], 1)
			.addPattern(Array(5).fill(WORK), 1)
			.addPattern([MOVE], 5)
			.addPattern([CARRY], 4)
			.addPattern(Array(10).fill(WORK), 1)
			.addPattern([MOVE], 10)
			.addPattern([CARRY], 5)
			.setSort([MOVE, CARRY, WORK])
			.setMaxCost(energy)
			.fabricate();

		let workParts = 0;
		for(let index in body)
			if(body[index] === WORK)
				workParts++;

		let parkingIndex = -1;
		for(let index = 0; index < this.memoryObject.parking.actors.length; index++)
			if(isNullOrUndefined(this.memoryObject.parking.actors[index]))
			{
				parkingIndex = index;
				break;
			}

		if(parkingIndex === -1) //no free spaces. Limited by room layout / roomscoring
			return;

		let actorResult = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor("upgrader", {workParts: workParts, parkingIndex: parkingIndex},
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //0
			, [CREEP_INSTRUCTION.MOVE_TO_POSITION, this.memoryObject.parking.spots[parkingIndex] ] //1
			, [CREEP_INSTRUCTION.PICKUP_AT_POS, this.memoryObject.energyPos, RESOURCE_ENERGY] //2
			, [CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY, this.memoryObject.controllerId] //3
			, [CREEP_INSTRUCTION.GOTO_IF_ALIVE,	2] //4
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "upgraderDied"] //5
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ] //6
			));

		this.memoryObject.creepCount++;
		this.memoryObject.workParts += workParts;
		this.memoryObject.parking.actors[parkingIndex] = actorResult.id;

		let maxCreeps = MAX_CREEPS_OVER_LEVEL[room.controller.level];
		if(this.memoryObject.workParts < TARGET_WORKPARTS && this.memoryObject.creepCount < maxCreeps)
			this.requestCreep();
	}

	upgraderDied(callbackObj)
	{
		this.memoryObject.creepCount--;
		this.memoryObject.workParts -= callbackObj.workParts;
		if(callbackObj.parkingIndex)
			this.memoryObject.parking.actors[callbackObj.parkingIndex] = null;

		let maxCreeps = MAX_CREEPS_OVER_LEVEL[this.core.getRoom(this.memoryObject.roomName).controller.level];
		if(this.memoryObject.workParts < TARGET_WORKPARTS && this.memoryObject.creepCount < maxCreeps)
			this.requestCreep();
	}
};