"use strict";

const Service = require('Service');

module.exports = class ServiceMemory extends Service
{
	constructor(locator)
	{
		super();
		this.memoryBank = locator.getCoreAccess().memoryBank;
	}

	getMemory(key)
	{
		return this.memoryBank.getMemory(key);
	}

	setMemory(key, value)
	{
		this.memoryBank.setMemory(key, value);
	}

	erase(key)
	{
		this.memoryBank.erase(key);
	}
};
