"use strict";

let ActorWithMemory = require('ActorWithMemory');

const creepName = "explorer";

module.exports = class ActorExplorer extends ActorWithMemory
{
	constructor(core)
	{
		this.core = core;
	}

	initiateActor(roomPath, spawnId)
	{
		this.core.subscribe("everyTick", this.actorId, "onEveryTick");
		this.memoryObject =
			{ roomPath: roomPath
			, remainingPath: roomPath
			};
	}

	removeActor()
	{
		this.core.unsubscribe("everyTick", this.actorId);
		super.removeActor();
	}

	onEveryTick()
	{
		let fullCreepName = creepName + this.actorId;

		let creep = Game.creeps[fullCreepName];

		if(!creep)
		{
			return;
		}
	}
};