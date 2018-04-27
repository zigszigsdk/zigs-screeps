"use strict";

const Service = require('Service');

module.exports = class ServiceGameObjectFinder extends Service
{
	constructor(locator)
	{
		super();
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	getNearestUnreservedResoucePositionAboveLevelInRoom(from, resourceType=RESOURCE_ENERGY, aboveLevel=0)
	{
		const isResourcecontainingStructure = function(structure)
		{
			switch(structure.structureType)
			{
				case STRUCTURE_CONTAINER:
				case STRUCTURE_STORAGE:
				case STRUCTURE_TERMINAL:

					return !isNullOrUndefined(structure.store[resourceType]) &&
						structure.store[resourceType] > aboveLevel;

				case STRUCTURE_EXTENSION:
				case STRUCTURE_LINK:

					return resourceType === RESOURCE_ENERGY && structure.energy > aboveLevel;

				case STRUCTURE_POWER_SPAWN:

					return (resourceType === RESOURCE_ENERGY && structure.energy > aboveLevel) ||
						(resourceType === RESOURCE_POWER && structure.power > aboveLevel);

				default:
					return false;
			}
		};

		const fromRoomPosition = this.screepsApi.getRoomPosition(from);
		const room = this.screepsApi.getRoom(from.roomName);

		const candPositions =
			_.map(
				(
					_.remove(
						room.find(FIND_DROPPED_RESOURCES)
						, (resource) => resource.resourceType === resourceType ||
										resource.amount <= aboveLevel
					)
				).concat(
					_.remove(
						room.find(FIND_STRUCTURES)
						, (structure) => isResourcecontainingStructure(structure)
					)
				)
				, (candidate)=>candidate.pos
			);

		if(candPositions.length === 0)
			return null;

		return fromRoomPosition.findClosestByPath(candPositions);
	}
};