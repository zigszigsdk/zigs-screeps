"use strict";

const bankDelimiter = "¤";
const kvpDelimiter = "#";

const API_MEMORY_KEY = "apiMemory";

module.exports = class MemoryBank
{
	rewindCore()
	{
		let memoryString = RawMemory.get();

		let banksKvp = {};

		if(memoryString === null || memoryString === undefined || memoryString === "")
			return;

		let banks = memoryString.split(bankDelimiter);

		banks.forEach(function(bank)
		{
			let kvp = bank.split(kvpDelimiter);
			if(kvp.length !== 2)
				return;

			banksKvp[kvp[0]] = kvp[1];
		});
		let apiMemory = this.getMemory(API_MEMORY_KEY);
		if(typeof apiMemory.creeps === UNDEFINED)
			apiMemory.creeps = {};

		this.banksKvp = banksKvp;
		RawMemory.set(JSON.stringify(apiMemory));
	}

	unwindCore()
	{
		let rawMemory = "";

		let apiMemory = RawMemory.get();

        if(apiMemory !== "")
    		try //in case rawMemory memory isn't saved or stored correctly, don't lose permanent memory.
    		{
    			this.setMemory(API_MEMORY_KEY, JSON.parse(apiMemory));
    		}
    		catch(e)
    		{
    			this.setMemory(API_MEMORY_KEY, {});

    			let message = "couldn't parse api memory: " + apiMemory;
    			if(isNullOrUndefined(this.logger))
    				console.log(message);
    			else
    				this.logger.logWarning(message);
    		}

		for (let bankKey in this.banksKvp)
		{
			if (!this.banksKvp.hasOwnProperty(bankKey) ||
				typeof this.banksKvp[bankKey] === "undefined" ||
				this.banksKvp[bankKey] === null ||
				this.banksKvp[bankKey] === "null"
			)
				continue;

			if(isNullOrUndefined(this.logger))
				console.log(bankKey + " is " + this.banksKvp[bankKey]);
			else
				this.logger.memory(bankKey, this.banksKvp[bankKey]);

			rawMemory += bankKey + kvpDelimiter + this.banksKvp[bankKey] + bankDelimiter;
		}

		RawMemory.set(rawMemory);
	}

	getMemory(bankKey)
	{
		if(typeof this.banksKvp !== UNDEFINED && typeof this.banksKvp[bankKey] !== UNDEFINED)
			return JSON.parse(this.banksKvp[bankKey]);

		return {};
	}

	setMemory(bankKey, value)
	{
		if(typeof bankKey === UNDEFINED || bankKey === null || bankKey === "")
			return;

		this.banksKvp[bankKey] = JSON.stringify(value);
	}

	erase(bankKey)
	{
		delete this.banksKvp[bankKey];
	}

	hardResetCore()
	{
		this.banksKvp = {};
		this.unwindCore();
	}

	setLogger(logger)
	{
		this.logger = logger;
	}
};