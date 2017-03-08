"use strict";

module.exports = class ActorWithMemory
{
	constructor(core)
	{
		this.core = core;
	}

	rewindActor(actorId)
	{
		this.actorId = actorId;
		this.bankKey = this.constructor.name + ":" + actorId;

		this.memoryObject = this.core.getMemory(this.bankKey);
	}

	initiateActor(roomName)
	{
		this.memoryObject = {};
	}

	resetActor(){}

	unwindActor()
	{
		this.core.setMemory(this.bankKey, this.memoryObject);
	}

	removeActor()
	{
		this.core.eraseMemory(this.bankKey);
		this.memoryObject = null;
	}

};