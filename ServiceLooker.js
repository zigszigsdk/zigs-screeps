"use strict";

const Service = require('Service');

module.exports = class ServiceLooker extends Service
{
	constructor(locator)
	{
		super();
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
	}

	//anything that takes up the usual space. thus not road or rampart, but still wall.
	getBuildingAt(at)
	{
		const structs = this.screepsApi.getRoomPosition(at).lookFor(LOOK_STRUCTURES);

		for(let index in structs)
			if(structs[index].structureType !== STRUCTURE_ROAD && structs[index].structureType !== STRUCTURE_RAMPART)
				return structs[index];


		return null;
	}

	getResourceAtOfType(at, resourceType)
	{
		const resources = this.screepsApi.getRoomPosition(at).lookFor(LOOK_RESOURCES);

		for(let index in resources)
			if(resources[index].resourceType === resourceType)
				return resources[index];

		return null;
	}
};