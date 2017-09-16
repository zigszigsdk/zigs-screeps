"use strict";

module.exports = class Resetter
{
	constructor(locator, actors)
	{
		this.locator = locator;
		this.actors = actors;
	}

	hardResetCore()
	{
		for(let name in Game.creeps)
			Game.creeps[name].suicide();

		this.locator.resetAllServices();

		this.actors.createNew(ACTOR_NAMES.TICK_EXPANDER);
		this.actors.createNew(ACTOR_NAMES.STRUCTURE_EVENTS);

		let mapStatus = this.locator.getService(SERVICE_NAMES.MAP_STATUS);

		for(let roomName in Game.rooms)
		{
			let room = Game.rooms[roomName];

			let sites = room.find(FIND_CONSTRUCTION_SITES);
			for(let index in sites)
				sites[index].remove();

			if(room.find(FIND_MY_SPAWNS).length === 0)
				continue;

			this.actors.createNew(ACTOR_NAMES.ROOM_BOOTER,(script)=>script.initiateActor(roomName));

			mapStatus.setBelongingToOwn(roomName);
		}
	}
};