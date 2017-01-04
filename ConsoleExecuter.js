"use strict";

const MEMORY_KEY = "core:consoleExecuter";

module.exports = class ConsoleExecuter
{
	constructor(core)
    {
        this.core = core;
    }

    rewindCore()
    {
    	this.memoryObject = this.core.getMemory(MEMORY_KEY);
    }

    execute()
    {
    	if(this.memoryObject.consoleInterfaceHook === null)
    		return;

    	switch(this.memoryObject.consoleInterfaceHook)
    	{
    		case 1:
    			this.core.logger.memoryObject.errors = {};
    			break;
    		case 2:
				this.core.logger.memoryObject.warnings = {};
    			break;
    		default:
    			break;
    	}
    }

    unwindCore()
    {
    	this.memoryObject = { consoleInterfaceHook: null };
    	this.core.setMemory(MEMORY_KEY, this.memoryObject);
    }

    hardResetCore(){}
};