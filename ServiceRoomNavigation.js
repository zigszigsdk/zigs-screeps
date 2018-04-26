"use strict";

const DELTA_TO_SCREEPS_DIRECTION_LOOKUP =	[ 	[ TOP_LEFT
												, LEFT
												, BOTTOM_LEFT
												]
											, 	[ TOP
												, null
												, BOTTOM
												]
											,	[ TOP_RIGHT
												, RIGHT
												, BOTTOM_RIGHT
												]
											];

const ServiceWithMemory = require('ServiceWithMemory');

module.exports = class ServiceMapStatus extends ServiceWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.logger = locator.getService(SERVICE_NAMES.LOGGER);
	}

	rewindService()
	{
		super.rewindService();
		if(!this.memoryObject.reservations)
			this.memoryObject.reservations = {};
	}
	reservePositions(roomName, positions, key, minRoomLevel=0)
	{
		if(isNullOrUndefined(this.memoryObject.reservations[roomName]))
			this.memoryObject.reservations[roomName] = {};

		this.memoryObject.reservations[roomName][key] = { positions: positions
														, minRoomLevel: minRoomLevel
														};
	}

	removeReservation(roomName, key)
	{
		if(isNullOrUndefined(this.memoryObject.reservations[roomName]))
			return;

		this.memoryObject.reservations[key] = undefined;

		if(_.isEmpty(this.memoryObject.reservations[roomName]))
			this.memoryObject.reservations[roomName] = undefined;
	}

	makePath(from, to, access=[], prefer=STRUCTURE_ROAD)
	{
		access = isArray(access) ? access : [access];

		const origin = this.screepsApi.getRoomPosition(from);
		const goals = [{pos:this.screepsApi.getRoomPosition(to), range:0}];

		let pathOptions;
		let roadCost;

		//intented effect:
		//have those which can walk on plain/swamp without slowing down not clog up the roads.
		//values are guesses and will in all likelyhood need to be tweaked based on
		//live observation, and further clculations.
		switch(prefer)
		{
			case TERRAIN_SWAMP:
				pathOptions =
					{ plainCost: 12.5
					, swampCost: 10
					};
				roadCost = 15.625;
				break;
			case TERRAIN_PLAIN:
				pathOptions =
					{ plainCost: 2
					, swampCost: 10
					};
				roadCost = 2.5;
				break;
			case STRUCTURE_ROAD:
				pathOptions =
					{ plainCost: 2
					, swampCost: 10
					};
				roadCost = 1;
				break;
			default:
				throw new Error("unknown path preference: " + prefer);
		}

		const screepsApi = this.screepsApi;
		const memoryObject = this.memoryObject;

		pathOptions.roomCallback = function(roomName)
		{
			let room = screepsApi.getRoom(roomName);
			if(isNullOrUndefined(room))
				return;

			let costs = new screepsApi.pathFinder.CostMatrix;

			room.find(FIND_STRUCTURES).forEach(function(struct) {
				if (struct.structureType === STRUCTURE_ROAD) {
					costs.set(struct.pos.x, struct.pos.y, roadCost);

				} else if (struct.structureType !== STRUCTURE_CONTAINER &&
					(struct.structureType !== STRUCTURE_RAMPART || !struct.my))
				{
					costs.set(struct.pos.x, struct.pos.y, 0xff);
				}
			});

			room.find(FIND_CREEPS).forEach(function(creep) {
				costs.set(creep.pos.x, creep.pos.y, 999);
			});

			const roomLevel = screepsApi.getRoomLevel(roomName);

			for(let keyName in memoryObject.reservations[roomName])
			{
				if(roomLevel < memoryObject.reservations[roomName][keyName].minRoomLevel)
					continue;

				let found = false;
				for(let accessIndex in access)
					if(keyName === access[accessIndex])
					{
						found = true;
						break;
					}
				if(found)
					break;

				for(let positionIndex in memoryObject.reservations[roomName][keyName].positions)
				{
					const pos = memoryObject.reservations[roomName][keyName].positions[positionIndex];
					costs.set(pos.x, pos.y, 0xff);
				}
			}
			return costs;
		};

		const pathObj = this.screepsApi.pathFinder.search(origin, goals, pathOptions);

		if(pathObj.incomplete === true)
			return [];

		const currentPosition = [{x: from[0], y: from[1], roomName: from[2]}];
		let route = currentPosition.concat(pathObj.path);

		let pathAsDirections = [];
		for(let routeIndex = 0; routeIndex + 1 < route.length; routeIndex++)
		{
			const current = route[routeIndex];
			const next = route[routeIndex+1];

			pathAsDirections.push(
				DELTA_TO_SCREEPS_DIRECTION_LOOKUP[next.x - current.x + 1][next.y - current.y + 1]);
		}

		return pathAsDirections;
	}
};