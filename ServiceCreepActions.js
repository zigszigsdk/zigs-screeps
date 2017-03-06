"use strict";

const Service = require("Service");

module.exports = class ServiceCreepActions extends Service
{
	constructor(core)
	{
		super(core);
	}

	spawn(creepName, body, spawnId)
	{
		this.core.getObjectById(spawnId).createCreep(body, creepName);
	}

	moveTo(creepName, posArray, stomp=false)
	{
		if(!stomp)
			return this.core.getCreep(creepName).moveTo(this.core.getRoomPosition(posArray));

		let creep = this.core.getCreep(creepName);
		let targetPos = this.core.getRoomPosition(posArray);
		creep.moveTo(targetPos);

		if(creep.pos.getRangeTo(targetPos) !== 1)
			return;

		let creeps = targetPos.lookFor(LOOK_CREEPS);
		if(creeps.length === 0 || creeps[0].my === false)
			return;

		creeps[0].suicide();
	}

	mine(creepName, sourceId)
	{
		this.core.getCreep(creepName).harvest(this.core.getObjectById(sourceId));
	}

	deposit(creepName, toId, resourceType, amount=undefined)
	{
		this.core.getCreep(creepName).transfer(this.core.getObjectById(toId), resourceType, amount);
	}

	withdraw(creepName, structureId, resourceType, amount=undefined)
	{
		this.core.getCreep(creepName).withdraw(this.core.getObjectById(structureId), resourceType, amount);
	}

	repair(creepName, structureId)
	{
		this.core.getCreep(creepName).repair(this.core.getObjectById(structureId));
	}
};