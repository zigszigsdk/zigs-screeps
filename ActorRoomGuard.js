"use strict";

const TOWER_MAX_DMG_RANGE = 5;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomGuard extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	initiateActor(parentId, roomName)
	{
		let towerLocations = this.roomScoring.getRoom(roomName).flower.tower;

		this.events.subscribe("everyTick", this.actorId, "onEveryTick");
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, towerLocations: towerLocations
			};
	}

	lateInitiate()
	{
		let parent = this.actors.get(this.memoryObject.parentId);

		for(let index in this.memoryObject.towerLocations)
			parent.requestBuilding([STRUCTURE_TOWER], this.memoryObject.towerLocations[index], PRIORITY_NAMES.BUILD.TOWER);
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.lateInitiate();
	}

	removeActor()
	{
		this.events.unsubscribe("everyTick", this.actorId);
		super.removeActor();
	}

	buildingCompleted(at, type){}

	onEveryTick()
	{
		let room = this.screepsApi.getRoom(this.memoryObject.roomName);

		let enemies = room.find(FIND_HOSTILE_CREEPS);

		if(enemies.length === 0)
			return;

		for(let index in this.memoryObject.towerLocations)
		{
			let towerPos = this.memoryObject.towerLocations[index];

			let towerRp = this.screepsApi.getRoomPosition(towerPos);

			let structs = towerRp.lookFor(LOOK_STRUCTURES);

			if(structs.length === 0 || structs[0].structureType !== STRUCTURE_TOWER)
				continue;

			let tower = structs[0];
			let target;

			let targets = towerRp.findInRange(enemies, TOWER_MAX_DMG_RANGE);

			if(targets.length !== 0)
				target = targets[Math.floor(Math.random() * targets.length)];
			else
				target = towerRp.findClosestByRange(enemies);

			tower.attack(target);
		}
	}
};