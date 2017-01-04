"use strict";

class CoreInterface
{
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

	startCpuLog()
	{
		this.logger.startCpuLog();
	}

	endCpuLog(text)
	{
		this.logger.endCpuLog(text);
	}
}

module.exports = CoreInterface;