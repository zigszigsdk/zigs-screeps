"use strict";

let unwrap = function(input)
{
	if(input === null || typeof input === UNDEFINED || typeof input === STRING)
		return input;

	else if(input.length) //ducktyping - input is array
	{
		let unwrapped = [];
		for(let index in input)
			if(input[index]._debugWrapperScreepsInner)
				unwrapped.push(input[index]._debugWrapperScreepsInner);
			else
				unwrapped.push(input[index]);
		return unwrapped;
	}
	else if (input._debugWrapperScreepsInner)
		return input._debugWrapperScreepsInner;

	return input;
};

module.exports = class DebugWrapperScreeps
{
	constructor(core, apiObj, reference)
	{
		this._debugWrapperScreepsInner = apiObj;

		core.startCpuLog(reference + ".constructor");

		for(let propertyName in apiObj)
		{
			if(propertyName === "constructor")
				continue;

			let definitionObj;
			switch(typeof apiObj[propertyName])
			{

				case NUMBER:
				case STRING:
				case BOOLEAN:
				case UNDEFINED:
				case SYMBOL:

					this[propertyName] = apiObj[propertyName];
					break;

				case FUNCTION:
					this[propertyName] = function(p1, p2, p3, p4, p5) //assuming max 5 parameters.
					{
						let text = reference + "." + propertyName;

						p1 = unwrap(p1);
						p2 = unwrap(p2);
						p3 = unwrap(p3);
						p4 = unwrap(p4);
						p5 = unwrap(p5);

						core.startCpuLog(text);
						let result = apiObj[propertyName](p1, p2, p3, p4, p5);
						core.endCpuLog(text);

						switch(typeof result)
						{
							case NUMBER:
							case STRING:
							case BOOLEAN:
							case UNDEFINED:
							case SYMBOL:
								return result;

							case OBJECT:
								if(result === null)
									return result;

								if(typeof result.length !== NUMBER) //ducktyping: is single object
									return new DebugWrapperScreeps(core, result, "(result of " + propertyName + ")");

								//is array

								if(result.length === 0)
									return [];

								let wrappedResult = [];
								for(let index in result)
								{
									switch(typeof result[index])
									{
										case NUMBER:
										case STRING:
										case BOOLEAN:
										case UNDEFINED:
										case SYMBOL:
											wrappedResult.push(result[index]);
											break;

										case OBJECT:
											if(result[index] === null)
												wrappedResult.push(result[index]);
											else
												wrappedResult.push(
													new DebugWrapperScreeps(
														core,
														result[index],
														"(a result of " + propertyName + ")"));
											break;

										default:
											wrappedResult.push(null);
											break;
									}
								}
								return wrappedResult;

							default:
								return undefined;
						}


						return result;
					};
					break;

				case OBJECT:
					if(apiObj[propertyName] === null) //typeof null is 'object'.
						break;

					definitionObj = {};
					definitionObj[propertyName] =
						{ "get": function()
							{
								return new DebugWrapperScreeps(core, apiObj[propertyName], propertyName);
							}
             			, "set": function() { return; }
        				};

				    Object.defineProperties(this, definitionObj);

					break;

				default:
					break;
			}
		}

		core.endCpuLog(reference + ".constructor");
	}
};