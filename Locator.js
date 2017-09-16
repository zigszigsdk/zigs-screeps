"use strict";

module.exports = class Locator
{
	constructor()
	{
		this.services = {};
		this.classes = {};
	}

	rewindCore()
	{
		let keys = Object.keys(this.services);
		for(let keyIndex in keys)
			this.services[keys[keyIndex]].rewindService();
	}

	unwindCore()
	{
		let keys = Object.keys(this.services);
		for(let keyIndex in keys)
			this.services[keys[keyIndex]].unwindService();
	}

	hardResetCore()
	{
		this.services = {};
		this.classes = {};
	}

	getService(name)
	{
		if(typeof name === UNDEFINED)
			throw new Error("tried to get an unexisting service. name is 'undefined'");

		if(this.services[name])
			return this.services[name];

		let ServiceClass = require(name);

		let service = new ServiceClass(this);
		service.rewindService();

		this.services[name] = service;

		return service;
	}

	resetService(name)
	{
		this.getService(name).resetService();
	}

	resetAllServices()
	{
		let keys = Object.keys(SERVICE_NAMES);
		for(let index in keys)
			this.resetService(SERVICE_NAMES[keys[index]]);
	}

	getClass(name)
	{
		if(typeof name === UNDEFINED)
			throw new Error("tried to get an unexisting class. name is 'undefined'");

		if(!this.classes[name])
			this.classes[name] = require(name);

		return this.classes[name];
	}

	getCoreAccess()
	{
		return this.coreAccess;
	}

	setCoreAccess(coreAccess)
	{
		this.coreAccess = coreAccess;
	}
};