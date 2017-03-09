"use strict";

const FILLER = "filler";
const RECOVERY_FILLER = "recoveryFiller";

const FULL_FILLER_ENERGY_COST = 1000;
const RECOVERY_FILLER_ENERGY_COST = 300;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomFill extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let scoring = roomScoring.getRoom(roomName);

		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, extensions: scoring.flower.extension
			, spawns: scoring.flower.spawn
			, links: scoring.flower.link
			, containers: scoring.flower.container
			, roads: scoring.flower.road
			, towers: scoring.flower.tower
			, energyLocations: []
			, recoveryFillActorId: null
			, regularFillActorId: null
			};
	}

	lateInitiate()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		//don't request towers. let ROOM_GUARD take care of that.

		let extensions = JSON.parse(JSON.stringify(this.memoryObject.extensions));

		let core = this.core;
		let extensionExists = function(pos)
		{
			let structs = core.getRoomPosition(pos).lookFor(LOOK_STRUCTURES);

			for(let structIndex = 0; structIndex < structs.length; structIndex++)
					if(structs[structIndex].structureType === STRUCTURE_EXTENSION)
						return 1;
			return 0;
		};

		extensions.sort((a, b) => extensionExists(b) - extensionExists(a) );

		for(let index in extensions)
			parent.requestBuilding([STRUCTURE_EXTENSION], extensions[index],
				index < 5 ? PRIORITY_NAMES.BUILD.EXTENSION_FIRST_FIVE : PRIORITY_NAMES.BUILD.EXTENSION_AFTER_FIVE);

		for(let index in this.memoryObject.spawns)
			parent.requestBuilding([STRUCTURE_SPAWN], this.memoryObject.spawns[index], PRIORITY_NAMES.BUILD.SPAWN);

		for(let index in this.memoryObject.links)
			parent.requestBuilding([STRUCTURE_LINK], this.memoryObject.links[index], PRIORITY_NAMES.BUILD.FLOWER_LINK);

		for(let index in this.memoryObject.containers)
		{
			parent.requestBuilding(	[STRUCTURE_CONTAINER],
									this.memoryObject.containers[index],
									PRIORITY_NAMES.BUILD.FLOWER_CONTAINER);
			//there should be a road under the container since it's walkable
			parent.requestBuilding([STRUCTURE_ROAD], this.memoryObject.containers[index], PRIORITY_NAMES.BUILD.FLOWER_ROAD);

			parent.requestResource(
				new this.ResourceRequest(this.memoryObject.containers[index], RESOURCE_ENERGY)
					.setPriorityName(PRIORITY_NAMES.RESOURCE.FILLER)
					.setRate(-5)
					.setDesired(1500)
					.setMin(500)
					.fabricate());
		}

		for(let index in this.memoryObject.roads)
			parent.requestBuilding([STRUCTURE_ROAD], this.memoryObject.roads[index], PRIORITY_NAMES.BUILD.FLOWER_ROAD);

		this.requestFiller();

	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.regularFillActorId = oldMemory.regularFillActorId;
		this.memoryObject.recoveryFillActorId = oldMemory.recoveryFillActorId;

		this.lateInitiate();

		for(let index in oldMemory.energyLocations)
			this.addEnergyLocation(oldMemory.energyLocations[index]);

	}

	buildingCompleted(at, type)
	{
		let room = this.core.getRoom(this.memoryObject.roomName);

		let getId = (list) => _.map(list, (item)=>item.id);
		let towers = getId(room.find(FIND_STRUCTURES, FILTERS.TOWERS));
		let extensions = getId(room.find(FIND_STRUCTURES, FILTERS.EXTENSIONS));
		let spawns = getId(room.find(FIND_STRUCTURES, FILTERS.SPAWNS));

		let subActorId = this.memoryObject.recoveryFillActorId;
		if(isNullOrUndefined(subActorId))
			return;
		let subActor = this.core.getActor(subActorId);

		subActor.replaceInstruction(4, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, towers]);
		subActor.replaceInstruction(5, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, extensions]);
		subActor.replaceInstruction(6, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, spawns]);
	}

	addEnergyLocation(energyRequest)
	{
		if(energyRequest.rate <= 0)
			return;

		for(let index in this.memoryObject.energyLocations)
		{
			let existingRequest = this.memoryObject.energyLocations[index];

			if(existingRequest.at[0] === energyRequest.at[0] &&
				existingRequest.at[1] === energyRequest.at[1] &&
				existingRequest.at[2] === energyRequest.at[2])
			{
				return;
			}
		}

		this.memoryObject.energyLocations.push(energyRequest);
	}

	requestFiller()
	{
		if(this.memoryObject.regularFillActorId !== null)
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.FILLER
			, energyNeeded: FULL_FILLER_ENERGY_COST
			});

		if(this.memoryObject.recoveryFillActorId !== null)
			return;

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.RECOVERY_FILLER
			, energyNeeded: RECOVERY_FILLER_ENERGY_COST
			});
	}

	createFiller(spawnId)
	{
		if(this.memoryObject.regularFillActorId !== null)
			return;

		let room = this.core.getRoom(this.memoryObject.roomName);

		if(room.energyAvailable === room.energyCapacityAvailable ||
			room.energyAvailable >= FULL_FILLER_ENERGY_COST)
			this._createFiller(spawnId);
		else
			this._createRecoveryFiller(spawnId);
	}
	_createRecoveryFiller(spawnId)
	{
		if(this.memoryObject.recoveryFillActorId !== null)
			return;

		let spawn = this.core.getObjectById(spawnId);

		let backupPoints = [];

		for(let index in this.memoryObject.energyLocations)
			backupPoints.push(this.memoryObject.energyLocations[index].at);

		let getId = (list) => _.map(list, (item)=>item.id);

		let towers = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.TOWERS));
		let extensions = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.EXTENSIONS));
		let spawns = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.SPAWNS));

		let body = [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];

		let containerPoint = this.memoryObject.containers[0];
		let linkPoint = this.memoryObject.links[0];

		let result = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor("recoveryFiller", {},
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //0
			, [CREEP_INSTRUCTION.PICKUP_AT_POS, linkPoint, RESOURCE_ENERGY] //1
			, [CREEP_INSTRUCTION.PICKUP_AT_POS, containerPoint, RESOURCE_ENERGY] //2
			, [CREEP_INSTRUCTION.PICKUP_AT_NEAREST,	backupPoints, RESOURCE_ENERGY] //3
			, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, towers] //4
			, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, extensions] //5
			, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, spawns] //6
			, [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 1] //7
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "fillerDied"] //8
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ] //9
		));

		this.memoryObject.recoveryFillActorId = result.id;
		this.requestFiller();
	}

	_createFiller(spawnId)
	{
		let callbackTo =
			{ actorId: this.actorId
			, diedFunctionName: "fillerDied"
			};

		let result = this.core.createActor(ACTOR_NAMES.CREEP_FILLER,
			(script)=>script.initiateActor(callbackTo, this.memoryObject.roomName, spawnId));

		this.memoryObject.regularFillActorId = result.id;
		if(this.memoryObject.recoveryFillActorId !== null)
		{
			this.core.removeActor(this.memoryObject.recoveryFillActorId);
			this.memoryObject.recoveryFillActorId = null;
		}

	}

	recoveryFillerDied()
	{
		this.memoryObject.recoveryFillActorId = null;
		this.requestFiller();
	}

	fillerDied()
	{
		this.memoryObject.regularFillActorId = null;
		this.requestFiller();
	}
};