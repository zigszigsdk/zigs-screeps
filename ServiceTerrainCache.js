"use strict";

let ServiceWithMemory = require('ServiceWithMemory');

module.exports = class ServiceTerrainCache extends ServiceWithMemory
{
	constructor(core)
	{
		super(core);
	}

	rewindService()
	{
		super.rewindService();

		if(typeof this.memoryObject.terrains === UNDEFINED)
			this.memoryObject.terrains = {};
	}

	cacheRoom(roomName)
	{
		let terrain = [];

		for(let x = FIRST_OF_ROOM; x <= LAST_OF_ROOM; x++)
		{
			let column = [];
			for(let y = FIRST_OF_ROOM; y <= LAST_OF_ROOM; y++)
				column.push(this.core.getRoomPosition([x, y, roomName]).lookFor(LOOK_TERRAIN)[0]);

			terrain.push(column);
		}

		this.memoryObject.terrains[roomName] = terrain;
	}

	getAt(x, y, roomName)
	{
		if(typeof this.memoryObject.terrains[roomName] === UNDEFINED)
			throw {msg: 'tried to get terrain of uncached room: ' + roomName};

		if(x < FIRST_OF_ROOM || y < FIRST_OF_ROOM || x > LAST_OF_ROOM || y > LAST_OF_ROOM)
			return TERRAIN_OUTSIDE_ROOM;

		return this.memoryObject.terrains[roomName][x][y];
	}
};