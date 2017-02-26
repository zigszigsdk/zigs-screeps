"use strict";

const DEFAULT_NO_PRODUCTION_OR_CONSUMPTION = 0;
const DEFAULT_CONTAINER_ONE_QUARTER_FULL = 500;
const DEFAULT_CONTAINER_THREE_QUARTER_FULL = 1500;
const DEFAULT_CONTAINER_FULL = 2000;

module.exports = class ResourceRequest
{
	constructor(at, type)
	{
		this.data =
			{ at: at
			, type: type
			, priorityName: PRIORITY_NAMES.RESOURCE.DEFAULT
			, rate: DEFAULT_NO_PRODUCTION_OR_CONSUMPTION
			, min: DEFAULT_CONTAINER_ONE_QUARTER_FULL
			, desired: DEFAULT_CONTAINER_THREE_QUARTER_FULL
			, max: DEFAULT_CONTAINER_FULL
			, parking: null
			};
	}

	export()
	{
		return this.data;
	}

	import(data)
	{
		this.data = data;
		return this;
	}

	setPriorityName(priorityName)
	{
		this.data.priorityName = priorityName;
		return this;
	}

	setMin(min)
	{
		this.data.min = min;
		return this;
	}

	setMax(max)
	{
		this.data.max = max;
		return this;
	}

	setDesired(desired)
	{
		this.data.desired = desired;
		return this;
	}

	setRate(rate)
	{
		this.data.rate = rate;
		return this;
	}

	setParking(at)
	{
		this.data.parking = at;
		return this;
	}

	fabricate()
	{
		return this.data;
	}
};