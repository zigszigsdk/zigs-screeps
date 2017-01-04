"use strict";

const FUNCTION = 'function';

module.exports = class DebugWrapperActor
{
	constructor(ActorClass, actorId, core)
	{
		core.startCpuLog(ActorClass.name + ".constructor");

		let actorInstance = new ActorClass(core);

		//doesn't see inhereted values. http://stackoverflow.com/questions/30881632/es6-iterate-over-class-methods
		let actorProperties = Object.getOwnPropertyNames( ActorClass.prototype );
		for(let index in actorProperties)
		{
			let propertyName = actorProperties[index];

			if(propertyName === "constructor")
				continue;

			if(typeof actorInstance[propertyName] === FUNCTION)
			{
				this[propertyName] = function(p1, p2, p3, p4, p5) //assuming max 5 parameters.
				{
					let text = ActorClass.name + "(" + actorId + ")." + propertyName;

					core.startCpuLog(text);
					let result = actorInstance[propertyName](p1, p2, p3, p4, p5);
					core.endCpuLog(text);

					return result;
				};
			}
		}
		core.endCpuLog(ActorClass.name + ".constructor");
	}
};