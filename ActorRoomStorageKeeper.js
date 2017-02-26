"use strict";

let MAX_SPAWN_ENERGY_NEEDED = 500;

let ActorWithMemory = require('ActorWithMemory');
module.exports = class ActorRoomStorageKeeper extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);
	}

	initiateActor(parentId, roomName)
	{
		let roomScore = this.core.getService(SERVICE_NAMES.ROOM_SCORING).getRoom(roomName);

		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, links: roomScore.storage.link
			, powerSpawns: roomScore.storage.powerSpawn
			, storages: roomScore.storage.storage
			, nukers: roomScore.storage.nuker
			, terminals: roomScore.storage.terminal
			, labs: roomScore.storage.lab
			, roads: roomScore.storage.road
			};
	}

	lateInitiate()
	{
		this._requestCreep();

		let parent = this.core.getActor(this.memoryObject.parentId);

		const requestBuilding = function(posList, type, priorityName, removeType)
		{
			if(removeType)
				parent.removeAllBuildingRequestsWithType(type);

			for(let index in posList)
				parent.requestBuilding(	[type], posList[index], priorityName);
		};

		requestBuilding(this.memoryObject.links, STRUCTURE_LINK, PRIORITY_NAMES.BUILD.STORAGE_LINK, true);
		requestBuilding(this.memoryObject.powerSpawns, STRUCTURE_POWER_SPAWN, PRIORITY_NAMES.BUILD.POWER_SPAWN, true);
		requestBuilding(this.memoryObject.storages, STRUCTURE_STORAGE, PRIORITY_NAMES.BUILD.STORAGE, true);
		requestBuilding(this.memoryObject.nukers, STRUCTURE_NUKER, PRIORITY_NAMES.BUILD.NUKER, true);
		requestBuilding(this.memoryObject.terminals, STRUCTURE_TERMINAL, PRIORITY_NAMES.BUILD.TERMINAL, true);
		requestBuilding(this.memoryObject.labs, STRUCTURE_LAB, PRIORITY_NAMES.BUILD.LAB, true);
		requestBuilding(this.memoryObject.roads, STRUCTURE_ROAD, PRIORITY_NAMES.BUILD.STORAGE_ROAD, false);

		for(let index in RESOURCES_ALL)
			parent.requestResource(
				new this.ResourceRequest(this.memoryObject.storages[0], RESOURCES_ALL[index])
					.setPriorityName(PRIORITY_NAMES.RESOURCE.STORAGE)
					.setMin(0)
					.setDesired(25000)
					.setMax(50000)
					.fabricate());
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.lateInitiate();
	}

	_requestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "spawnCreep"
			, priority: PRIORITY_NAMES.SPAWN.STORAGE_KEEPER
			, energyNeeded: MAX_SPAWN_ENERGY_NEEDED
			});
	}

	spawnCreep(spawnId)
	{
		let room = this.core.getRoom(this.memoryObject.roomName);
		let energy = room.energyAvailable;

		let body = new this.CreepBodyFactory()
	        .addPattern([CARRY, CARRY, MOVE], 8)
            .setMaxCost(energy)
            .fabricate();
	}
};