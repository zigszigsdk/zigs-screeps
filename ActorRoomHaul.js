"use strict";

let ActorWithMemory = require('ActorWithMemory');

const MAX_SUBACTORS_PER_ROUTE = 1;

const MIN_RESOURCE_ADDITION_IF_ENERGY = 500;

const SCORE_NONE = 0;
const SCORE_ABOVE_MAX = 1;
const SCORE_ABOVE_DESIRED = 2;
const SCORE_BELOW_DESIRED = 3;

module.exports = class ActorRoomHaul extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);

		this.bodypartPredicter = locator.getService(SERVICE_NAMES.BODYPART_PREDICTER);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, resourceRequests: []
			, routes: []
			, unassignedSubActorIds: []
			, live: false
			};
	}

	lateInitiate()
	{
		this.events.subscribe(EVENTS.STRUCTURE_DESTROYED, this.actorId, "structureDestroyed");
		this.events.subscribe(EVENTS.STRUCTURE_BUILD, this.actorId, "structureBuild");
		this.memoryObject.live = true;
		this.update();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		for(let routeIndex in oldMemory.routes)
			for(let actorIndex in oldMemory.routes[routeIndex].subActorIds)
			{
				if(isNullOrUndefined(this.actors.get(
						oldMemory.routes[routeIndex].subActorIds[actorIndex])))
					continue;
				this.memoryObject.unassignedSubActorIds.push(
					oldMemory.routes[routeIndex].subActorIds[actorIndex]);
			}

		for(let index in oldMemory.resourceRequests)
			this.requestResource(oldMemory.resourceRequests[index]);

		this.lateInitiate();

	}

	requestResource(newRequest)
	{
		for(let index in this.memoryObject.resourceRequests)
		{
			let existingRequest = this.memoryObject.resourceRequests[index];

			if(	existingRequest.type !== newRequest.type ||
				existingRequest.at[0] !== newRequest.at[0] ||
				existingRequest.at[1] !== newRequest.at[1] ||
				existingRequest.at[2] !== newRequest.at[2])
				continue;

			this.memoryObject.resourceRequests[index] = newRequest;
			this.update();

			return;
		}

		this.memoryObject.resourceRequests.push(newRequest);
		this.update();
	}

	removeRequestsAt(at)
	{
		let update = false;

		for(let index = this.memoryObject.resourceRequests.length-1; index >= 0; index--)
		{
			let existingRequest = this.memoryObject.resourceRequests[index];

			if(existingRequest.at[0] !== at[0] ||
				existingRequest.at[1] !== at[1] ||
				existingRequest.at[2] !== at[2])
				continue;

			this.memoryObject.resourceRequests.splice(index, 1);
			update = true;
		}

		if(update)
			this.update();
	}

	update()
	{
		if(!this.memoryObject.live)
			return;

		for(let routeIndex in this.memoryObject.routes)
			for(let subActorIndex in this.memoryObject.routes[routeIndex].subActorIds)
				this.memoryObject.unassignedSubActorIds.push(
					this.memoryObject.routes[routeIndex].subActorIds[subActorIndex]);

		this.recalculateRoutes();

		for(let routeIndex in this.memoryObject.routes)
		{
			if(this.memoryObject.unassignedSubActorIds.length !== 0)
				this.reassignSubActor(routeIndex);
			else
				this.requestSpawn(routeIndex);
		}

	}

	structureDestroyed() { this.update(); }
	structureBuild() { this.update(); }

	recalculateRoutes()
	{
		this.memoryObject.routes = [];
		let inputRequests = {};
		let outputRequests = {};

		for(let index in RESOURCES_ALL)
		{
			inputRequests[RESOURCES_ALL[index]] = [];
			outputRequests[RESOURCES_ALL[index]] = [];
		}

		const roomLevel = this.screepsApi.getRoom(this.memoryObject.roomName).controller.level;

		for(let requestIndex in this.memoryObject.resourceRequests)
		{
			let resourceRequest = this.memoryObject.resourceRequests[requestIndex];

			if(roomLevel < resourceRequest.minRoomLevel)
				continue;

			if(resourceRequest.rate > 0)
				inputRequests[resourceRequest.type].push(resourceRequest);
			else
				outputRequests[resourceRequest.type].push(resourceRequest);
		}

		let descendingByPriority = (a, b) => PRIORITIES[b.priorityName] - PRIORITIES[a.priorityName];

		let routeIndex = 0;
		for(let resourceIndex in RESOURCES_ALL)
		{
			inputRequests[RESOURCES_ALL[resourceIndex]].sort(descendingByPriority);
			outputRequests[RESOURCES_ALL[resourceIndex]].sort(descendingByPriority);

			for(let inputIndex in inputRequests[RESOURCES_ALL[resourceIndex]])
			{
				let inputRequest = inputRequests[RESOURCES_ALL[resourceIndex]][inputIndex];
				let dropPoints = [];
				let dropPointsAt = [];
				let resourceType = inputRequests[RESOURCES_ALL[resourceIndex]][inputIndex].type;

				if(resourceType === RESOURCE_ENERGY)
					for(let outputIndex in outputRequests[RESOURCES_ALL[resourceIndex]])
					{
						let at = outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].at;
						dropPointsAt.push(at);
						dropPoints.push(
							{ at: at
							, desired: outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].desired
							, max: outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].max
							});
					}
				else
					for(let outputIndex in outputRequests[RESOURCES_ALL[resourceIndex]])
					{
						let rp = this.screepsApi.getRoomPosition(outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].at);
						let acceptedStructs = _.filter(rp.lookFor(LOOK_STRUCTURES),
							(struct) =>	struct.structureType === STRUCTURE_CONTAINER ||
										struct.structureType === STRUCTURE_STORAGE ||
										struct.structureType === STRUCTURE_TERMINAL);

						if(acceptedStructs.length !== 0)
						{
							let at = outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].at;
							dropPointsAt.push(at);
							dropPoints.push(
								{ at: at
								, desired: outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].desired
								, max: outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].max
								, navPermissions: outputRequests[RESOURCES_ALL[resourceIndex]][outputIndex].navPermissions
								});
						}
					}

				if(dropPoints.length === 0)
					continue;

				let fillPoints =
					[{ at: inputRequest.at
					, min: inputRequest.min
					, parking: inputRequest.parking
					, navPermissions: inputRequest.navPermissions
					}];

				this.memoryObject.routes.push(
					{ routeIndex: routeIndex++
					, type: resourceType
					, fillPoints: fillPoints
					, dropPoints: dropPoints
					, subActorIds: []
					, carryParts: 0
					, targetCarryParts: this.bodypartPredicter.haulerCarry(fillPoints[0].at, dropPointsAt, 10)
					});
			}
		}
	}

	createHauler(spawnId, callbackObj)
	{
		let actorCallbackObj = this.initiateHauler(callbackObj, spawnId);

		if(isNullOrUndefined(actorCallbackObj))
			return;

		let instructions = this.getInstructions(actorCallbackObj.fillPoint,
												actorCallbackObj.dropPoint,
												actorCallbackObj.type,
												spawnId,
												actorCallbackObj.body);

		let actorResult = this.actors.create(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor("hauler", actorCallbackObj, instructions));

		this.registerActor(actorCallbackObj, actorResult.id);
	}

	reassignSubActor(routeIndex)
	{
		let subActorId = this.memoryObject.unassignedSubActorIds.pop();

		let callbackObj = this.initiateHauler({routeIndex: routeIndex}, null);

		if(isNullOrUndefined(callbackObj))
			return;
		
		let instructions = this.getInstructions(callbackObj.fillPoint,
												callbackObj.dropPoint,
												callbackObj.type,
												callbackObj.spawnId,
												callbackObj.body);

		let subActor = this.actors.get(subActorId);
		subActor.replaceInstructions(instructions);
		subActor.setCallbackObj(callbackObj);

		this.registerActor(callbackObj, subActorId);
	}

	initiateHauler(callbackObj, spawnId)
	{
		let route = this.memoryObject.routes[callbackObj.routeIndex];
		if(isUndefinedOrNull(route) ||
			route.subActorIds.length >= MAX_SUBACTORS_PER_ROUTE ||
			route.carryParts >= route.targetCarryParts)
			return;

		let dropPoint = this.getDropPoint(route);
		let body = this.getBody(callbackObj.routeIndex);
		let carryParts = this.getCarryParts(body);

		return 	{ routeIndex: callbackObj.routeIndex
				, fillPoint: route.fillPoints[0]
				, carryParts: carryParts
				, dropPoint: dropPoint
				, type: route.type
				, spawnId: spawnId
				, body: body
				};
	}

	registerActor(callbackObj, actorId)
	{
		this.memoryObject.routes[callbackObj.routeIndex].subActorIds.push(actorId);
		this.memoryObject.routes[callbackObj.routeIndex].carryParts += callbackObj.carryParts;

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
			let rp = this.screepsApi.getRoomPosition(dropPointHere.at);
			let resourceHere = 0;

			let storages = rp.lookFor(LOOK_STRUCTURES, FILTERS.ANY_STORAGE);
			let storageFull = false;
			for(let storageIndex in storages)
				if(storages[storageIndex].store && storages[storageIndex].store[route.type])
					if(_.sum(storages[storageIndex].store) === storages[storageIndex].storeCapacity)
						storageFull = true;
					else
						resourceHere += storages[storageIndex].store[route.type];
				else if(route.type === RESOURCE_ENERGY && storages[storageIndex].energy)
					if(storages[storageIndex].energy === storages[storageIndex].energyCapacity)
						storageFull = true;
					else
						resourceHere += storages[storageIndex].energy;

			if(storageFull)
				continue;

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
		const min = type === RESOURCE_ENERGY ?
			MIN_RESOURCE_ADDITION_IF_ENERGY + from.min :
			from.min;

		return [  [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //00
				, [CREEP_INSTRUCTION.MOVE_TO_POSITION, from.parking, from.navPermissions] //01
				, [CREEP_INSTRUCTION.PICKUP_AT_POS, from.at, type, min] //02
				, [CREEP_INSTRUCTION.GOTO_IF_TTL_LESS, 9, 175] //03

				, [CREEP_INSTRUCTION.DEPOSIT_AT, to.at, type, to.max] //04
				, [CREEP_INSTRUCTION.GOTO_IF_DEAD, 10] //05
				, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "haulCompleted"] //06
				, [CREEP_INSTRUCTION.GOTO_IF_CREEP_EMPTY, 1] //07
				, [CREEP_INSTRUCTION.GOTO, 4] //08

				, [CREEP_INSTRUCTION.DEPOSIT_AT, from.at, type] //09
				, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "haulerDied"] //10
				, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ];//11
	}

	haulCompleted(callbackObj, subActorId)
	{
		let route = this.memoryObject.routes[callbackObj.routeIndex];

		if(isNullOrUndefined(route)) //the routes have been changed and the hauler is no longer needed
			return this.actors.remove(subActorId);

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

		let subActor = this.actors.get(subActorId);

		subActor.replaceInstructions(instructions);
		subActor.setCallbackObj(actorCallbackObj);
	}

	getBody(routeIndex)
	{
		let route = this.memoryObject.routes[routeIndex];
		let maxRepeats = route.targetCarryParts - route.carryParts;

		let energy = this.screepsApi.getRoom(this.memoryObject.roomName).energyCapacityAvailable;

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
		let route = this.memoryObject.routes[routeIndex];
		if(route.subActorIds.length >= MAX_SUBACTORS_PER_ROUTE ||
			route.carryParts >= route.targetCarryParts)
			return;

		let parent = this.actors.get(this.memoryObject.parentId);
		parent.requestCreep(
				{ actorId: this.actorId
				, functionName: "createHauler"
				, priority: PRIORITY_NAMES.SPAWN.HAULER
				, energyNeeded: (route.targetCarryParts - route.carryParts) * 100
				, callbackObj:
					{ routeIndex: routeIndex
					}
				});
	}


};