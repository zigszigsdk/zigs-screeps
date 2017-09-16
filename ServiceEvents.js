"use strict";

const Service = require('Service');

module.exports = class ServiceEvents extends Service
{
	constructor(locator)
	{
		super();

		let coreAccess = locator.getCoreAccess();
		this.subscriptions = coreAccess.subscriptions;
		this.eventQueue = coreAccess.eventQueue;
	}

	unsubscribe(eventName, actorId)
	{
		this.subscriptions.unsubscribe(eventName, actorId);
	}

	subscribe(eventName, actorId, callbackMethodName)
	{
		this.subscriptions.subscribe(eventName, actorId, callbackMethodName);
	}

	callbackAfter(afterTick, actorId, callbackMethodName)
	{
		this.subscriptions.callbackAfter(afterTick, actorId, callbackMethodName);
	}

	frontLoadEvent(event)
	{
		this.eventQueue.frontLoad(event);
	}

	rearLoadEvent(event)
	{
		this.eventQueue.rearLoad(event);
	}
};
