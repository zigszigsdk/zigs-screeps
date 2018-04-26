"use strict";

const MEMORY_KEYWORD = "core:subscriptions";

module.exports = class Subscriptions
{
	constructor(memoryBank, logger)
	{
		this.memoryBank = memoryBank;
		this.logger = logger;
	}

	rewindCore()
	{
		this.memoryObject = this.memoryBank.getMemory(MEMORY_KEYWORD);
	}

	unwindCore()
	{
		this.memoryBank.setMemory(MEMORY_KEYWORD, this.memoryObject);
	}

	subscribe(eventString, actor, callbackMethod)
	{
		if(eventString === "" || isNullOrUndefined(eventString) || isNullOrUndefined(actor) ||
			isNullOrUndefined(callbackMethod))
			this.logger.warning("Tried to subscribe with invalid parameters. eventString: " +
				eventString +
				", actor: " +
				actor +
				", callbackMethod: " +
				callbackMethod);

		if(!this.memoryObject[eventString])
			this.memoryObject[eventString] = {};

		this.memoryObject[eventString][actor] = callbackMethod;
	}

	unsubscribe(eventString, actor)
	{
		delete this.memoryObject[eventString][actor];
	}

	getSubscribersForEvent(eventString)
	{
		return this.memoryObject[eventString];
	}

	hardResetCore()
	{
		this.memoryObject = {};
	}
};