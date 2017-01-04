"use strict";

module.exports = class CoreInterface
{
	constructor()
	{
		if(DEBUG)
			this.DebugWrapperScreeps = require("DebugWrapperScreeps");
	}

	setLogger(logger) { this.logger = logger; }
	setEventQueue(eventQueue) { this.eventQueue = eventQueue; }
	setSubscriptions(subscriptions) { this.subscriptions = subscriptions; }
	setMemoryBank(memoryBank) { this.memoryBank = memoryBank; }
	setActors(actors) { this.actors = actors; }

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

	roomPosition(x, y, roomName)
	{
		if(!DEBUG)
			return new RoomPosition(x,y,roomName);

		return new this.DebugWrapperScreeps(this, new RoomPosition(x, y, roomName), "(a RoomPosition)" );
	}

	room(name)
	{
		if(!DEBUG)
			return Game.rooms[name];

		let room = Game.rooms[name];
		if(typeof room === 'undefined' || room === null)
			return null;

		return new this.DebugWrapperScreeps(this, room, "(a Room)");
	}

	creep(name)
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
};
