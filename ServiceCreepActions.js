"use strict";

const Service = require("Service");

module.exports = class ServiceCreepActions extends Service
{
	constructor(locator)
	{
		super();
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	spawn(creepName, body, spawnId)
	{
		return this.screepsApi.getObjectById(spawnId).createCreep(body, creepName);
	}

	moveTo(creepName, posArray, stomp=false)
	{
		if(!stomp)
			return this.screepsApi.getCreep(creepName).moveTo(this.screepsApi.getRoomPosition(posArray));

		let creep = this.screepsApi.getCreep(creepName);
		let targetPos = this.screepsApi.getRoomPosition(posArray);
		let result = creep.moveTo(targetPos);

		if(creep.pos.getRangeTo(targetPos) !== 1)
			return result;

		let creeps = targetPos.lookFor(LOOK_CREEPS);
		if(creeps.length === 0 || creeps[0].my === false)
			return result;

		creeps[0].suicide();

		return result;
	}

	mine(creepName, sourceId)
	{
		return this.screepsApi.getCreep(creepName).harvest(this.screepsApi.getObjectById(sourceId));
	}

	deposit(creepName, toId, resourceType, amount=undefined)
	{
		return this.screepsApi.getCreep(creepName).transfer(this.screepsApi.getObjectById(toId), resourceType, amount);
	}

	withdraw(creepName, structureId, resourceType, amount=undefined)
	{
		return this.screepsApi.getCreep(creepName).withdraw(this.screepsApi.getObjectById(structureId), resourceType, amount);
	}

	pickup(creepName, pileId)
	{
		return this.screepsApi.getCreep(creepName).pickup(this.screepsApi.getObjectById(pileId));
	}

	repair(creepName, structureId)
	{
		return this.screepsApi.getCreep(creepName).repair(this.screepsApi.getObjectById(structureId));
	}
};