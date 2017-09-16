"use strict";

const ActorWithMemory = require('ActorWithMemory');
const NO_CONTROLLER_IN_ROOM = -1;

module.exports = class ActorTickExpander extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.events = locator.getService(SERVICE_NAMES.EVENTS);
	}

	initiateActor()
	{
		super.initiateActor();
		this.events.subscribe("everyTick", this.actorId, "onEveryTick");
		this.memoryObject =
			{ roomLevels: {}
			};
	}

	removeActor()
	{
		this.events.unsubscribe("everyTick", this.actorId);
		super.removeActor();
	}

	onEveryTick(event)
	{
		let tick = Game.time;
		let counter = 1;

		for(let mod=2; tick % mod === 0; mod *= 2)
			this.events.frontLoadEvent("tick2pow" + counter++);

		for(let roomName in Game.rooms)
		{
			let oldRoomLevel = this.memoryObject.roomLevels[roomName];

			let room = Game.rooms[roomName];
			let currentRoomLevel = room.controller ? room.controller.level : NO_CONTROLLER_IN_ROOM;

			if(typeof oldRoomLevel === UNDEFINED || oldRoomLevel !== currentRoomLevel)
			{
				this.memoryObject.roomLevels[roomName] = currentRoomLevel;
				this.events.frontLoadEvent(EVENTS.ROOM_LEVEL_CHANGED + roomName);
			}
		}
	}
};