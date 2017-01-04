"use strict";

module.exports = class ServiceLocator
{
	constructor(core)
	{
		this.core = core;
		this.localCache =
			{ services:{}
			};
	}

	getService(name)
	{
		if(! this.localCache.services[name])
		{
			let script;
			try
			{
				script = require(name);
			}
			catch(err)
			{
				this.core.logWarning("attempted to load unknown script as a service: " + name);
			}

			if(	typeof script.buildService !== 'function' ||
				typeof script.rewindService !== 'function') //ducktyping
			{
				this.core.logWarning("loaded script " + name + " is not a service!");
				return null;
			}

			this.localCache.services[name] = script;
		}

		return this.localCache.services[name];
	}
};