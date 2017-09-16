"use strict";

module.exports = class ActorWithMemory
{
	constructor(locator)
	{
		this.memory = locator.getService(SERVICE_NAMES.MEMORY);
	}

	rewindActor(actorId)
	{
		this.actorId = actorId;
		this.bankKey = this.constructor.name + ":" + actorId;

		this.memoryObject = this.memory.getMemory(this.bankKey);
	}

	initiateActor(roomName)
	{
		this.memoryObject = {};
	}

	resetActor(){}

	unwindActor()
	{
		this.memory.setMemory(this.bankKey, this.memoryObject);
	}

	removeActor()
	{
		this.memory.erase(this.bankKey);
		this.memoryObject = null;
	}

};