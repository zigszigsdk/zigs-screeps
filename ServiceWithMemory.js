"use strict";

module.exports = class ServiceWithMemory
{
	constructor(core)
	{
		this.core = core;
	}

	rewindService()
	{
        this.memoryObject = this.core.getMemory(this.constructor.name);
	}

	unwindService()
	{
		this.core.setMemory(this.constructor.name, this.memoryObject);
	}
};