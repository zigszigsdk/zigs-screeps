"use strict";

const MEMORY_KEYWORD = "core:subscriptions";

module.exports = class Subscriptions
{
	constructor(core)
	{
		this.core = core;
	}

	rewindCore()
	{
		this.memoryObject = this.core.getMemory(MEMORY_KEYWORD);
	}

	unwindCore()
	{
		this.core.setMemory(MEMORY_KEYWORD, this.memoryObject);
	}

	subscribe(eventString, actor, callbackMethod)
	{
		if(eventString === "" || isNullOrUndefined(eventString) || isNullOrUndefined(actor) ||
			isNullOrUndefined(callbackMethod))
			this.core.logWarning("Tried to subscribe with invalid parameters. eventString: " +
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