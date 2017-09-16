"use strict";

const Service = require('Service');

module.exports = class ServiceScreepsApi extends Service
{
	getStructureAt(posArr, structureType)
	{
		let structs = this.getRoomPosition(posArr).lookFor(LOOK_STRUCTURES);
		for(let index in structs)
		{
			if(structs[index].structureType === structureType)
				return structs[index];
		}
		return null;
	}

	getRoomPosition(list)
	{
		if(!DEBUG)
			return new RoomPosition(list[0], list[1], list[2]);

		return new this.DebugWrapperScreeps(this, new RoomPosition(list[0], list[1], list[2]), "(a RoomPosition)" );
	}

	getRoom(name)
	{
		if(!DEBUG)
			return Game.rooms[name];

		let room = Game.rooms[name];
		if(typeof room === 'undefined' || room === null)
			return null;

		return new this.DebugWrapperScreeps(this, room, "(a Room)");
	}

	getCreep(name)
	{
		if(!DEBUG)
			return Game.creeps[name];

		let creep = Game.creeps[name];
		if(typeof creep === 'undefined' || creep === null)
			return null;

		return new this.DebugWrapperScreeps(this, creep, "(a Creep)");
	}

	getObjectById(id)
	{
		if(!DEBUG)
			return Game.getObjectById(id);

		return new this.DebugWrapperScreeps(this, Game.getObjectById(id), "(result of objectById)");
	}

	getObjectFromId(id){return this.getObjectById(id);}

	getSpawn(name)
	{
		if(!DEBUG)
			return Game.spawns[name];

		let spawn = Game.spawns[name];
		if(typeof spawn === 'undefined' || spawn === null)
			return null;

		return new this.DebugWrapperScreeps(this, spawn, "(a StructureSpawn)");
	}
};