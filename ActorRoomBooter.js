"use strict";

let ActorWithMemory = require("ActorWithMemory");

module.exports = class ActorRoomBooter extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.terrainCache = locator.getService(SERVICE_NAMES.TERRAIN_CACHE);
		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
	}

	initiateActor(roomName)
	{
		this.events.subscribe(EVENTS.EVERY_TICK_LATE, this.actorId, "onEveryTickLate");
		this.memoryObject =
			{ phase: 0
			, roomName: roomName};
	}

	resetActor()
	{
		this.initiateActor(this.memoryObject.roomName);
	}

	removeActor()
	{
		this.events.unsubscribe(EVENTS.EVERY_TICK_LATE, this.actorId);
		super.removeActor();
	}

	onEveryTickLate()
	{
		console.log("phase: " + this.memoryObject.phase);
		switch(this.memoryObject.phase)
		{
			case 0:
				this.terrainCache.cacheRoom(this.memoryObject.roomName);
				this.memoryObject.phase++;
				break;

			case 1:
				this.roomScoring.scoreRoom(this.memoryObject.roomName);
				this.memoryObject.phase++;
				break;

			case 2:
				this.actors.create(ACTOR_NAMES.CONTROLLED_ROOM,
					(script) => script.initiateActor(this.memoryObject.roomName));
				this.memoryObject.phase++;
				break;

			case 3:
				this.actors.remove(this.actorId);
				break;
		}
	}

};