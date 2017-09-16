"use strict";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorStructureEvents extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	initiateActor()
	{
		super.initiateActor();
		this.events.subscribe("everyTick", this.actorId, "onEveryTick");
		this.memoryObject =
			{ structures: {}
			};
	}

	removeActor()
	{
		this.events.unsubscribe("everyTick", this.actorId);
		super.removeActor();
	}

	onEveryTick(event)
	{
		let newStructureIds = Object.keys(Game.structures);
		for(let idIndex in newStructureIds)
		{
			let newStructureId = newStructureIds[idIndex];

			if(this.memoryObject.structures[newStructureId])
				continue;

			let roomName = this.screepsApi.getObjectById(newStructureId).room.name;

			this.events.frontLoadEvent(EVENTS.STRUCTURE_BUILD + newStructureId);
			this.events.frontLoadEvent(EVENTS.STRUCTURE_BUILD + roomName);
			this.memoryObject.structures[newStructureId] =
				{ roomName: roomName
				};
		}

		let oldStructureIds = Object.keys(this.memoryObject.structures);
		for(let idIndex in oldStructureIds)
		{
			let oldStructureId = oldStructureIds[idIndex];

			if(Game.structures[oldStructureId])
				continue;

			this.events.frontLoadEvent(EVENTS.STRUCTURE_DESTROYED + oldStructureId);
			this.events.frontLoadEvent(EVENTS.STRUCTURE_DESTROYED + this.memoryObject.structures[oldStructureId].roomName);
			delete this.memoryObject.structures[oldStructureId];
		}

	}
};