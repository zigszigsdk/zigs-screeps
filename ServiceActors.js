"use strict";

const Service = require('Service');

module.exports = class ServiceActors extends Service
{
	constructor(locator)
	{
		super();
		this.actors = locator.getCoreAccess().actors;
	}

	get(actorId)
	{
		return this.actors.getFromId(actorId);
	}

	actorScriptname(actorId)
	{
		return this.actors.getScriptname(actorId);
	}

	create(scriptname, initFunc)
	{
		return this.actors.createNew(scriptname, initFunc);
	}

	remove(actorId)
	{
		this.actors.removeActor(actorId);
	}

	reset(actorId)
	{
		this.actors.resetActor(actorId);
	}
};