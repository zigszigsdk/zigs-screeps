"use strict";

let MAX_SPAWN_ENERGY_NEEDED = 500;

let ActorWithMemory = require('ActorWithMemory');
module.exports = class ActorRoomStorageKeeper extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = locator.getClass(CLASS_NAMES.RESOURCE_REQUEST);

		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
	}

	initiateActor(parentId, roomName)
	{
		let roomScore = this.roomScoring.getRoom(roomName);

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

		let parent = this.actors.get(this.memoryObject.parentId);

		const requestBuilding = function(posList, type, priorityName, removeType, minRoomLevel, separatePriorityNames)
		{
			if(removeType)
				parent.removeAllBuildingRequestsWithType(type);

			if(requestBuilding)
				for(let index in posList)
					parent.requestBuilding(	[type], posList[index], priorityName[index], minRoomLevel);
			else
				for(let index in posList)
					parent.requestBuilding(	[type], posList[index], priorityName, minRoomLevel);
		};

		requestBuilding(this.memoryObject.links, STRUCTURE_LINK, PRIORITY_NAMES.BUILD.STORAGE_LINK, false);
		requestBuilding(this.memoryObject.powerSpawns, STRUCTURE_POWER_SPAWN, PRIORITY_NAMES.BUILD.POWER_SPAWN, true);
		requestBuilding(this.memoryObject.storages, STRUCTURE_STORAGE, PRIORITY_NAMES.BUILD.STORAGE, true);
		requestBuilding(this.memoryObject.nukers, STRUCTURE_NUKER, PRIORITY_NAMES.BUILD.NUKER, true);
		requestBuilding(this.memoryObject.terminals, STRUCTURE_TERMINAL, PRIORITY_NAMES.BUILD.TERMINAL, true);
		requestBuilding(this.memoryObject.roads, STRUCTURE_ROAD, PRIORITY_NAMES.BUILD.STORAGE_ROAD, false, 2);
		requestBuilding(this.memoryObject.labs, STRUCTURE_LAB, PRIORITY_NAMES.BUILD.LAB, true, true);

		for(let index in RESOURCES_ALL)
			parent.requestResource(
				new this.ResourceRequest(this.memoryObject.storages[0], RESOURCES_ALL[index])
					.setPriorityName(PRIORITY_NAMES.RESOURCE.STORAGE)
					.setMin(0)
					.setDesired(25000)
					.setMax(50000)
					.setMinRoomLevel(4)
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
		let parent = this.actors.get(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "spawnCreep"
			, priority: PRIORITY_NAMES.SPAWN.STORAGE_KEEPER
			, energyNeeded: MAX_SPAWN_ENERGY_NEEDED
			});
	}

	spawnCreep(spawnId)
	{
		let room = this.screepsApi.getRoom(this.memoryObject.roomName);
		let energy = room.energyAvailable;

		let body = new this.CreepBodyFactory()
			.addPattern([CARRY, CARRY, MOVE], 8)
			.setMaxCost(energy)
			.fabricate();
	}
};