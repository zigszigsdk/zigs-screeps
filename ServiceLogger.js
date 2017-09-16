"use strict";

const Service = require('Service');

module.exports = class ServiceLogger extends Service
{
	constructor(locator)
	{
		super();
		this.logger = locator.getCoreAccess().logger;
	}

	warning(text)
	{
		this.logger.warning(text);
	}

	error(text, error)
	{
		this.logger.error(text, error);
	}

	display(text)
	{
		this.logger.display(text);
	}

	memory(key, memory)
	{
		this.logger.memory(key, memory);
	}

	startCpuLog(text)
	{
		this.logger.startCpuLog(text);
	}

	endCpuLog(text)
	{
		this.logger.endCpuLog(text);
	}
};