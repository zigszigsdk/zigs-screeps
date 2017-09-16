"use strict";

const PATHOPTION_STATIC = {ignoreCreeps: true, ignoreRoads: true};

const LOAD_UNLOAD_TIME = 2;
const CARRY_BODYPART_CAPACITY = 50;
const MARGIN = 1.25;


const Service = require('Service');

module.exports = class ServiceBodypartPredicter extends Service
{
	constructor(locator)
	{
		super();
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	haulerCarry(fromPoint, toPoints, toHaulPerTick)
	{
		let fromRoomPosition = this.screepsApi.getRoomPosition(fromPoint);
		let maxDistance = 0;

		for(let index in toPoints)
		{
			let toPoint = this.screepsApi.getRoomPosition(toPoints[index]);
			let distance = fromRoomPosition.findPathTo(toPoint, PATHOPTION_STATIC).length;

			if(distance > maxDistance)
				maxDistance = distance;
		}

		const workTime = LOAD_UNLOAD_TIME + maxDistance + maxDistance;
		const toHaulPerInWorkTime = workTime * toHaulPerTick;
		return Math.ceil(toHaulPerInWorkTime * MARGIN / CARRY_BODYPART_CAPACITY);
	}
};
