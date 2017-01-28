"use strict";

const TOWER_MAX_DMG_RANGE = 5;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomGuard extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let towerLocations = roomScoring.getRoom(roomName).flower.tower;

		this.core.subscribe("everyTick", this.actorId, "onEveryTick");
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, towerLocations: towerLocations
			};
	}

	lateInitiate()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		for(let index in this.memoryObject.towerLocations)
			parent.requestBuilding([STRUCTURE_TOWER], this.memoryObject.towerLocations[index], PRIORITY_NAMES.BUILD.TOWER);
	}

	removeActor()
	{
		this.core.unsubscribe("everyTick", this.actorId);
		super.removeActor();
	}

	buildingCompleted(at, type){}

	onEveryTick()
	{
		for(let index in this.memoryObject.towerLocations)
		{
			let towerPos = this.memoryObject.towerLocations[index];

			let towerRp = this.core.getRoomPosition([towerPos[0], towerPos[1], this.memoryObject.roomName]);

	        let structs = towerRp.lookFor(LOOK_STRUCTURES);
	        if(structs.length === 0 || structs[0].structureType !== STRUCTURE_TOWER)
	            return;

	        let room = this.core.room(this.memoryObject.location[2]);

	        let enemies = room.find(FIND_HOSTILE_CREEPS);

	        if(enemies.length === 0)
	            return;

	        let targets = towerRp.findInRange(enemies, TOWER_MAX_DMG_RANGE);

	        let tower = structs[0];
	        let target;

	        if(targets.length === 0)
	        	target = targets[Math.floor(Math.random() * targets.length)];
	        else
	        	target = enemies[Math.floor(Math.random() * targets.length)];

	        tower.attack(target);
	    }
	}
};