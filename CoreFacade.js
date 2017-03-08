"use strict";

module.exports = class CoreFacade
{
	constructor()
	{
		if(DEBUG)
			this.DebugWrapperScreeps = require('DebugWrapperScreeps');
	}

	setLogger(logger) { this.logger = logger; }
	setEventQueue(eventQueue) { this.eventQueue = eventQueue; }
	setSubscriptions(subscriptions) { this.subscriptions = subscriptions; }
	setMemoryBank(memoryBank) { this.memoryBank = memoryBank; }
	setActors(actors) { this.actors = actors; }
	setLocator(locator) { this.locator = locator; }

	getMemory(key)
	{
		return this.memoryBank.getMemory(key);
	}

	setMemory(key, value)
	{
		this.memoryBank.setMemory(key, value);
	}

	eraseMemory(key)
	{
		this.memoryBank.erase(key);
	}

	unsubscribe(eventName, actorId)
	{
		this.subscriptions.unsubscribe(eventName, actorId);
	}

	subscribe(eventName, actorId, callbackMethodName)
	{
		this.subscriptions.subscribe(eventName, actorId, callbackMethodName);
	}

	actorFromId(actorId)
	{
		return this.actors.getFromId(actorId);
	}

	getActor(actorId)
	{
		return this.actors.getFromId(actorId);
	}

	actorScriptname(actorId)
	{
		return this.actors.getScriptname(actorId);
	}

	createActor(scriptname, initFunc)
	{
		return this.actors.createNew(scriptname, initFunc);
	}

	removeActor(actorId)
	{
		this.actors.removeActor(actorId);
	}

	resetActor(actorId)
	{
		this.actors.resetActor(actorId);
	}

	frontLoadEvent(event)
	{
		this.eventQueue.frontLoad(event);
	}

	rearLoadEvent(event)
	{
		this.eventQueue.rearLoad(event);
	}

	logWarning(text)
	{
		this.logger.warning(text);
	}

	logError(text, error)
	{
		this.logger.error(text, error);
	}

	logDisplay(text)
	{
		this.logger.display(text);
	}

	logMemory(key, memory)
	{
		this.logger.memory(key, memory);
	}

	startCpuLog(text)
	{
		this.logger.startCpuLog(text);
	}

	endCpuLog(text)
	{
		this.logger.endCpuLog(text);
	}

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

	getService(serviceName, callerObj)
	{
		return this.locator.getService(serviceName, callerObj);
	}

	resetService(serviceName)
	{
		this.locator.resetService(serviceName);
	}

	resetAllServices()
	{
		this.locator.resetAllServices();
	}

	getSpawn(name)
	{
		if(!DEBUG)
			return Game.spawns[name];

		let spawn = Game.spawns[name];
		if(typeof spawn === 'undefined' || spawn === null)
			return null;

		return new this.DebugWrapperScreeps(this, spawn, "(a StructureSpawn)");
	}

	getClass(className)
	{
		return this.locator.getClass(className);
	}

	//legacy interface

	creep(name)
	{
		this.logWarning("using legacy interface CoreInterface.creep(name). Use CoreInterface.getCreep(name)");
		return this.getCreep(name);
	}

	room(name)
	{
		this.logWarning("using legacy interface CoreInterface.room(name). Use CoreInterface.getRoom(name)");
		return this.getRoom(name);
	}

	roomPosition(x, y, roomName)
	{
		this.logWarning("using legacy interface CoreInterface.roomPosition(x, y, roomName). " +
			"Use CoreInterface.getRoomPosition([x, y, roomName])");

		return this.getRoomPosition([x, y, roomName]);
	}

	resetAllActors()
	{
		this.actors.resetAll();
	}
};
