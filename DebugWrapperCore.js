"use strict";

const FUNCTION = 'function';

module.exports = class DebugWrapperCore
{
	constructor(Class, core)
	{
		let instance = new Class(core);

		//doesn't see inhereted values. http://stackoverflow.com/questions/30881632/es6-iterate-over-class-methods
		let properties = Object.getOwnPropertyNames( Class.prototype );

		for(let index in properties)
		{
			let propertyName = properties[index];

			if(propertyName === "constructor")
				continue;

			if(typeof instance[propertyName] === FUNCTION)
			{
				//would create circular calling when calling those two functions in a few lines
				if(propertyName === "startCpuLog" || propertyName === "endCpuLog")
					this[propertyName] = function(p1, p2, p3, p4, p5)
					{
						return instance[propertyName](p1,p2,p3,p4,p5);
					};
				else
					this[propertyName] = function(p1, p2, p3, p4, p5) //assuming max 5 parameters.
					{
						let text = Class.name + "." + propertyName;

						core.startCpuLog(text);
						let result = instance[propertyName](p1, p2, p3, p4, p5);
						core.endCpuLog(text);

						return result;
					};
			}
		}

	}
};