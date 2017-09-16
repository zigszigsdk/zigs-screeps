"use strict";

module.exports = class ServiceWithMemory
{
	constructor(locator)
	{
		this.memory = locator.getService(SERVICE_NAMES.MEMORY);
	}

	rewindService()
	{
		this.memoryObject = this.memory.getMemory(this.constructor.name);
	}

	unwindService()
	{
		this.memory.setMemory(this.constructor.name, this.memoryObject);
	}

	resetService()
	{
		this.memoryObject = {};
		this.memory.setMemory(this.constructor.name, {});
	}
};

