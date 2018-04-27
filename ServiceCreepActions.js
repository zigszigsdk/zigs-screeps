"use strict";

const Service = require("Service");

module.exports = class ServiceCreepActions extends Service
{
	constructor(locator)
	{
		super();
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.roomNavigation = locator.getService(SERVICE_NAMES.ROOM_NAVIGATION);
		this.looker = locator.getService(SERVICE_NAMES.LOOKER);
	}

	spawn(creepName, body, spawnId)
	{
		return this.screepsApi.getObjectById(spawnId).createCreep(body, creepName);
	}

	moveTo(creepName, posArray, stomp=false)
	{
		const creep = this.screepsApi.getCreep(creepName);

		if(isNullOrUndefined(creep))
			return 0;

		if(!stomp)
			return creep.moveTo(this.screepsApi.getRoomPosition(posArray));

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

	generatePath(creepName, to, navPermission=[], terrainPreference=STRUCTURE_ROAD)
	{
		const from = this.screepsApi.getCreep(creepName).pos;
		return this.roomNavigation.makePath(
			[from.x, from.y, from.roomName],
			to,
			navPermission,
			{terrainPreference: terrainPreference}
		);
	}

	followPath(creepName, path)
	{
		const creep = this.screepsApi.getCreep(creepName);

		if(creep.fatigue !== 0)
			return path;

		const nextMove = path.shift();

		if(creep.move(nextMove) !== OK)
			path.unshift(nextMove);

		return path;
	}

	moveWithPath(creepName, to, path, navPermission=[], terrainPreference=STRUCTURE_ROAD)
	{
		if(isNullOrUndefined(path) || path.length === 0)
			path = this.generatePath(creepName, to, navPermission, terrainPreference);

		return this.followPath(creepName, path);
	}

	mine(creepName, sourceId)
	{
		return this.screepsApi.getCreep(creepName).harvest(this.screepsApi.getObjectById(sourceId));
	}

	deposit(creepName, toId, resourceType, amount=undefined)
	{
		return this.screepsApi.getCreep(creepName).transfer(this.screepsApi.getObjectById(toId), resourceType, amount);
	}

	withdraw(creepName, structure, resourceType, amount=undefined)
	{
		const structureObj = isObject(structure) ? structure : this.screepsApi.getObjectById(structure);
		return this.screepsApi.getCreep(creepName).withdraw(structureObj, resourceType, amount);
	}

	pickup(creepName, pileId)
	{
		return this.screepsApi.getCreep(creepName).pickup(this.screepsApi.getObjectById(pileId));
	}

	repair(creepName, structureId)
	{
		return this.screepsApi.getCreep(creepName).repair(this.screepsApi.getObjectById(structureId));
	}

	upgrade(creepName, controller)
	{
		const controllerObj = isObject(controller) ? controller : this.screepsApi.getObjectById(controller);
		if(this.screepsApi.getCreep(creepName).upgradeController(controllerObj) === ERR_NOT_IN_RANGE)
			this.moveTo(creepName, [controllerObj.pos.x, controllerObj.pos.y, controllerObj.pos.roomName]);
	}

	withdrawOrPickupAt(creepName, at, resourceType=RESOURCE_ENERGY, amount=undefined)
	{
		const building = this.looker.getBuildingAt(at);

		let canWithdraw = false;
		if(!isNullOrUndefined(building))
			switch(building.structureType)
			{
				case STRUCTURE_CONTAINER:
				case STRUCTURE_STORAGE:
				case STRUCTURE_TERMINAL:

					if(!isNullOrUndefined(building.store[resourceType]) && building.store[resourceType] !== 0)
						canWithdraw = true;
					break;

				case STRUCTURE_SPAWN:
				case STRUCTURE_EXTENSION:
				case STRUCTURE_LINK:
				case STRUCTURE_TOWER:

					if(resourceType === RESOURCE_ENERGY && building.energy !== 0)
						canWithdraw = true;
					break;

				case STRUCTURE_POWER_SPAWN:

					if(resourceType === RESOURCE_ENERGY && building.energy !== 0)
						canWithdraw = true;
					else if(resourceType === RESOURCE_POWER && building.power !== 0)
						canWithdraw = true;
					break;

				case STRUCTURE_NUKER:

					if(resourceType === RESOURCE_ENERGY && building.energy !== 0)
						canWithdraw = true;
					else if(resourceType === RESOURCE_GHODIUM && building.ghodium !== 0)
						canWithdraw = true;
					break;

				case STRUCTURE_LAB:

					if(resourceType === RESOURCE_ENERGY && building.energy !== 0)
						canWithdraw = true;
					else if(resourceType === building.mineralType && building.mineralAmount !== 0)
						canWithdraw = true;
					break;
			}

		if(canWithdraw)
		{
			const withdrawResult = this.withdraw(creepName, building, resourceType);
			if(withdrawResult === ERR_NOT_IN_RANGE)
				this.moveTo(creepName, at);
			return;
		}

		const resource = this.looker.getResourceAtOfType(at, resourceType);

		if(isNullOrUndefined(resource))
			return;

		if(this.pickup(creepName, resource.id) === ERR_NOT_IN_RANGE)
			this.moveTo(creepName, at);
	}
};