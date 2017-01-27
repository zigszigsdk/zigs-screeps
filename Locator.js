"use strict";

module.exports = class Locator
{
	constructor(core)
	{
		this.core = core;
		this.services = {};
		this.outdatedServices = {};
		this.classes = {};
	}

	rewindCore()
	{
		this.outdatedServices = this.services;
		this.services = {};
	}

	unwindCore()
	{
		let keys = Object.keys(this.services);
		for(let keyIndex in keys)
			this.services[keys[keyIndex]].unwindService();
	}

	hardResetCore()
	{
		this.outdatedServices = {};
		this.services = {};
		this.classes = {};
	}

	getService(name)
	{
		if(typeof name === UNDEFINED)
			throw "tried to get an unexisting service. name is undefined";

		if(this.services[name])
			return this.services[name];

		if(this.outdatedServices[name])
		{
			this.outdatedServices[name].rewindService();
			this.services[name] = this.outdatedServices[name];
			return this.services[name];
		}

		let ServiceClass = require(name);

		let service = new ServiceClass(this.core);
		service.rewindService();

		this.services[name] = service;

		return service;
	}

	getClass(name)
	{
		if(typeof name === UNDEFINED)
			throw "tried to get an unexisting class. name is undefined";

		if(!this.classes[name])
			this.classes[name] = require(name);

		return this.classes[name];
	}
};