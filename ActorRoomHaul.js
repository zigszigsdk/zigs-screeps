"use strict";

let ActorWithMemory = require('ActorWithMemory');

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
			, nextResourceRequestId: 0
			, resourceRequests: []
			, pickupRequests: []
			, routes: []
			, requestedSpawn: false
			, subActorIds: []
			};
	}

	requestResource(at, type, priority, amount)
	{
		for(let index in this.memoryObject.resourceRequests)
		{
			let request = this.memoryObject.resourceRequests[index];
			if(request.at[0] === at[0] && request.at[1] === at[1] && request.at[2] === at[2] && request.type === type)
				return;
		}

		this.memoryObject.resourceRequests.push(
			{ at: at
			, type: type
			, priority: priority
			, amount: amount
			}
		);

		this.update();
	}

	requestPickup(at, type)
	{
		for(let index in this.memoryObject.pickupRequests)
		{
			let request = this.memoryObject.pickupRequests[index];
			if(request.at[0] === at[0] && request.at[1] === at[1] && request.at[2] === at[2] && request.type === type)
				return;
		}

		this.memoryObject.pickupRequests.push(
			{ at: at
			, type: type
			}
		);

		this.update();
	}

	update()
	{
		this.recalculateRoutes();
		this.redistributeWorkers();
	}

	recalculateRoutes()
	{
		this.memoryObject.routes = [];

		if(this.memoryObject.resourceRequests.length === 0 || this.memoryObject.pickupRequests.length === 0)
			return;

		for(let requestIndex in this.memoryObject.resourceRequests)
		{
			let resourceRequest = this.memoryObject.resourceRequests[requestIndex];
			let resourceRequestPos = new RoomPosition(resourceRequest.at[0], resourceRequest.at[1], resourceRequest.at[2]);

			let bestScore = Number.NEGATIVE_INFINITY;
			let bestCandidate = null;

			for(let pickupIndex in this.memoryObject.pickupRequests)
			{
				let pickupRequest = this.memoryObject.pickupRequests[pickupIndex];
				if(resourceRequest.type !== pickupRequest.type)
					continue;

				let pickupRequestPos = new RoomPosition(pickupRequest.at[0], pickupRequest.at[1], pickupRequest.at[2]);
				let score = - resourceRequestPos.findPathTo(pickupRequestPos).length;

				if(score <= bestScore)
					continue;

				bestScore = score;
				bestCandidate = pickupRequest;
			}

			this.memoryObject.routes.push(
				{ from: bestCandidate.at
				, to: resourceRequest.at
				, type: resourceRequest.type
				, priority: resourceRequest.priority
				, occopied: false
				});
		}

		this.memoryObject.routes.sort((a, b)=> b.priority - a.priority); //descending
	}

	redistributeWorkers()
	{
		for(let index in this.memoryObject.subActorIds)
			this.core.removeActor(this.memoryObject.subActorIds[index]);

		if(this.memoryObject.routes.length === 0 || this.memoryObject.requestedSpawn)
			return;

		this.requestSpawn();
	}

	createHauler(spawnId)
	{
		let route = null;
		let routeIndex = 0;

		for(routeIndex in this.memoryObject.routes)
			if(! this.memoryObject.routes[routeIndex].occopied)
			{
				route = this.memoryObject.routes[routeIndex];
				break;
			}

		if(route === null)
			return;

		let energy = this.core.room(this.memoryObject.roomName).energyCapacityAvailable;

		let body = new this.CreepBodyFactory()
            .addPattern([CARRY, MOVE], 3)
            .setSort([CARRY, MOVE])
            .setMaxCost(energy)
            .fabricate();

        let actorResult = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor("hauler", {routeIndex: routeIndex},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,	[spawnId],		body 			] //0
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, 		route.from, 	route.type,	150	] //1
            , [CREEP_INSTRUCTION.DEPOSIT_AT, 			route.to,		route.type 		] //2
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 		1 								] //3
            , [CREEP_INSTRUCTION.CALLBACK, 				this.actorId,	"haulerDied" 	] //4
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT 									  ] ] //5
            ));

        this.memoryObject.subActorIds.push(actorResult.id);

        this.memoryObject.routes[routeIndex].occopied = true;

		this.memoryObject.requestedSpawn = false;

        for(let index in this.memoryObject.routes)
			if(! this.memoryObject.routes[index].occopied)
			{
				this.requestSpawn();
				break;
			}

	}

	haulerDied(callbackObj)
	{
		this.memoryObject.routes[callbackObj.routeIndex].occopied = false;

		this.requestSpawn();
	}

	requestSpawn()
	{
		if(this.memoryObject.requestedSpawn)
			return;

		this.memoryObject.requestedSpawn = true;
		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
				{ actorId: this.actorId
				, functionName: "createHauler"
				, priority: PRIORITIES.SPAWN.HAULER
				});
	}
};