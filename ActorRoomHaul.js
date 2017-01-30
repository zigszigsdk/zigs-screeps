"use strict";

let ActorWithMemory = require('ActorWithMemory');

const TARGET_CARRY_PARTS = 10;
const MAX_SUBACTORS_PER_ROUTE = 1;

const SCORE_NONE = 0;
const SCORE_ABOVE_MAX = 1;
const SCORE_ABOVE_DESIRED = 2;
const SCORE_BELOW_DESIRED = 3;

module.exports = class ActorRoomHaul extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, resourceRequests: []
			, routes: []
			};
	}

	lateInitiate(){}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		for(let routeIndex in oldMemory.routes)
			for(let actorIndex in oldMemory.routes[routeIndex].subActorIds)
				this.core.removeActor(oldMemory.routes[routeIndex].subActorIds[actorIndex]);

		this.lateInitiate();

		for(let index in oldMemory.resourceRequests)
			this.requestResource(oldMemory.resourceRequests[index]);
	}

	requestResource(newRequest)
	{
		for(let index in this.memoryObject.resourceRequests)
		{
			let existingRequest = this.memoryObject.resourceRequests[index];

			if(	existingRequest.type === newRequest.type &&
				existingRequest.at[0] === newRequest.at[0] &&
				existingRequest.at[1] === newRequest.at[1] &&
				existingRequest.at[2] === newRequest.at[2])
				return;
		}
		this.memoryObject.resourceRequests.push(newRequest);
		this.update();
	}

	update()
	{
		this.saveSubActors();
		this.recalculateRoutes();
		this.redistributeSubActors();
	}

	recalculateRoutes()
	{
		this.memoryObject.routes = [];

		let inputRequests = [];
		let outputRequests = [];

		for(let requestIndex in this.memoryObject.resourceRequests)
		{
			let resourceRequest = this.memoryObject.resourceRequests[requestIndex];
			if(resourceRequest.rate > 0)
				inputRequests.push(resourceRequest);
			else
				outputRequests.push(resourceRequest);
		}

		if(inputRequests.length === 0 || outputRequests.length === 0)
			return;

		let descendingByPriority = (a, b) => PRIORITIES[b.priorityName] - PRIORITIES[a.priorityName];
		inputRequests.sort(descendingByPriority);
		outputRequests.sort(descendingByPriority);

		for(let inputIndex in inputRequests)
		{
			let inputRequest = inputRequests[inputIndex];
			let dropPoints = [];

			for(let outputIndex in outputRequests)
				dropPoints.push(
					{ at: outputRequests[outputIndex].at
					, desired: outputRequests[outputIndex].desired
					, max: outputRequests[outputIndex].max
					});

			let fillPoints = [{at: inputRequest.at, min: inputRequest.min}];

			this.memoryObject.routes.push(
				{ routeIndex: inputIndex
				, type: inputRequests[inputIndex].type
				, fillPoints: fillPoints
				, dropPoints: dropPoints
				, subActorIds: []
				, carryParts: 0
				});
		}
	}

	saveSubActors()
	{
		this.detatchedSubActorIds = [];
		for(let routeIndex in this.memoryObject.routes)
			for(let subActorIndex in this.memoryObject.routes[routeIndex].subActorIds)
				this.detatchedSubActorIds.push(this.memoryObject.routes[routeIndex].subActorIds[subActorIndex]);
	}

	redistributeSubActors()
	{
		let routeIndex;
		for(routeIndex in this.memoryObject.routes)
			if(this.detatchedSubActorIds.length > routeIndex)
				this.reuseSubActor(this.detatchedSubActorIds[routeIndex], routeIndex);
			else
				this.requestSpawn(routeIndex);

		for(let subActorIndex = routeIndex; subActorIndex < this.detatchedSubActorIds.length; subActorIndex++)
			this.core.removeActor(this.detatchedSubActorIds[subActorIndex]);
	}

	reuseSubActor(subActorId, routeIndex)
	{
		let route = this.memoryObject.routes[routeIndex];
		let subActor = this.core.getActor(subActorId);
		let oldCallbackObj = subActor.getCallbackObj();

		let dropPoint = this.getDropPoint(route);
		let carryParts = this.getCarryParts(oldCallbackObj.body);
		let instructions = this.getInstructions(
			route.fillPoints[0],
			dropPoint,
			route.type,
			oldCallbackObj.spawnId,
			oldCallbackObj.body);

		subActor.replaceInstructions(instructions);
		subActor.setCallbackObj(
			{ routeIndex: routeIndex
			, fillPoint: route.fillPoints[0]
			, dropPoint: dropPoint
			, type: route.type
			, spawnId: oldCallbackObj.spawnId
			, body: oldCallbackObj.body
			});

		this.memoryObject.routes[routeIndex].subActorIds.push(subActorId);
		this.memoryObject.routes[routeIndex].carryParts += carryParts;

		this.requestSpawn(routeIndex);
	}

	createHauler(spawnId, callbackObj)
	{
		if(this.memoryObject.routes[callbackObj.routeIndex].subActorIds.length >= MAX_SUBACTORS_PER_ROUTE ||
			this.memoryObject.routes[callbackObj.routeIndex].carryParts >= TARGET_CARRY_PARTS)
			return;

		let route = this.memoryObject.routes[callbackObj.routeIndex];

		let dropPoint = this.getDropPoint(route);
		let body = this.getBody(callbackObj.routeIndex);
		let carryParts = this.getCarryParts(body);
		let instructions = this.getInstructions(route.fillPoints[0], dropPoint, route.type, spawnId, body);

		let actorCallbackObj =
			{ routeIndex: callbackObj.routeIndex
			, fillPoint: route.fillPoints[0]
			, carryParts: carryParts
			, dropPoint: dropPoint
			, type: route.type
			, spawnId: spawnId
			, body: body
			};

        let actorResult = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor("hauler", actorCallbackObj, instructions));

        this.memoryObject.routes[callbackObj.routeIndex].subActorIds.push(actorResult.id);
		this.memoryObject.routes[callbackObj.routeIndex].carryParts += carryParts;

		this.requestSpawn(callbackObj.routeIndex);
	}

	getCarryParts(body)
	{
		let count = 0;
		for(let index in body)
			if(body[index] === CARRY)
				count++;

		return count;
	}

	getDropPoint(route)
	{
		let dropPoint = null;
		let dropPointScore = SCORE_NONE;

		for(let dropIndex in route.dropPoints)
		{
			let dropPointHere = route.dropPoints[dropIndex];
			let rp = this.core.getRoomPosition(dropPointHere.at);
			let resourceHere = 0;

			let storages = rp.lookFor(LOOK_STRUCTURES, FILTERS.ANY_STORAGE);
			for(let storageIndex in storages)
				if(storages[storageIndex].store && storages[storageIndex].store[route.type])
					resourceHere += storages[storageIndex].store[route.type];
				else if(route.type === RESOURCE_ENERGY && storages[storageIndex].energy)
					resourceHere += storages[storageIndex].energy;

			let resourcePools = rp.lookFor(LOOK_RESOURCES);
			for(let resourceIndex in resourcePools)
				if(resourcePools[resourceIndex].resourceType === route.type)
					resourceHere += resourcePools[resourceIndex].amount;

			if(dropPointScore < SCORE_BELOW_DESIRED && resourceHere < dropPointHere.desired)
			{
				dropPoint = dropPointHere;
				break;
			}

			if(dropPointScore < SCORE_ABOVE_DESIRED && resourceHere < dropPointHere.max)
			{
				dropPoint = dropPointHere;
				dropPointScore = SCORE_ABOVE_DESIRED;
				continue;
			}

			if(dropPointScore < SCORE_ABOVE_MAX && resourceHere >= dropPointHere.max)
			{
				dropPoint = dropPointHere;
				dropPointScore = SCORE_ABOVE_MAX;
				continue;
			}
		}

		return dropPoint;
	}


	getInstructions(from, to, type, spawnId, body)
	{
		return [  [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,	[spawnId],		body 					] //0
            	, [CREEP_INSTRUCTION.PICKUP_AT_POS, 		from.at,		type,			from.min] //1
            	, [CREEP_INSTRUCTION.DEPOSIT_AT, 			to.at,			type,			to.max	] //2
				, [CREEP_INSTRUCTION.GOTO_IF_DEAD, 			6 										] //3
            	, [CREEP_INSTRUCTION.CALLBACK, 				this.actorId,	"haulCompleted"			] //4
            	, [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 		1 										] //5
            	, [CREEP_INSTRUCTION.CALLBACK, 				this.actorId,	"haulerDied" 			] //6
            	, [CREEP_INSTRUCTION.DESTROY_SCRIPT 									  		  ] ];//7
	}

	haulCompleted(callbackObj, subActorId)
	{
		let route = this.memoryObject.routes[callbackObj.routeIndex];
		let dropPoint = this.getDropPoint(route);
		let instructions = this.getInstructions(
			route.fillPoints[0],
			dropPoint,
			route.type,
			callbackObj.spawnId,
			callbackObj.body);

		let actorCallbackObj =
			{ routeIndex: callbackObj.routeIndex
			, fillPoint: route.fillPoints[0]
			, dropPoint: dropPoint
			, carryParts: callbackObj.carryParts
			, type: route.type
			, spawnId: callbackObj.spawnId
			, body: callbackObj.body
			};

		let subActor = this.core.getActor(subActorId);

		subActor.replaceInstructions(instructions);
		subActor.setCallbackObj(actorCallbackObj);
	}

	getBody(routeIndex)
	{
		let maxRepeats = TARGET_CARRY_PARTS - this.memoryObject.routes[routeIndex].carryParts;

		let energy = this.core.room(this.memoryObject.roomName).energyCapacityAvailable;

		return new this.CreepBodyFactory()
            .addPattern([CARRY, MOVE], maxRepeats)
            .setSort([CARRY, MOVE])
            .setMaxCost(energy)
            .fabricate();
	}

	haulerDied(callbackObj, subActorId)
	{
		let at = this.memoryObject.routes[callbackObj.routeIndex].subActorIds.indexOf(subActorId);
		if(at !== -1)
			this.memoryObject.routes[callbackObj.routeIndex].subActorIds.splice(at, 1);

		this.memoryObject.routes[callbackObj.routeIndex].carryParts -= callbackObj.carryParts;

		this.requestSpawn(callbackObj.routeIndex);
	}

	requestSpawn(routeIndex)
	{
		if(this.memoryObject.routes[routeIndex].subActorIds.length >= MAX_SUBACTORS_PER_ROUTE ||
			this.memoryObject.routes[routeIndex].carryParts >= TARGET_CARRY_PARTS)
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
				{ actorId: this.actorId
				, functionName: "createHauler"
				, priority: PRIORITY_NAMES.SPAWN.HAULER
				, energyNeeded: (TARGET_CARRY_PARTS - this.memoryObject.routes[routeIndex].carryParts) * 100
				, callbackObj:
					{ routeIndex: routeIndex
					}
				});
	}
};