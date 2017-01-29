"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorControlledRoom extends ActorWithMemory
{
		constructor(core)
		{
			super(core);
		}

		initiateActor(roomName)
		{
			let mapCalc = this.core.getService(SERVICE_NAMES.MAP_CALC);

	        this.core.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

	        this.memoryObject =
	            { room: mapCalc.parseRoomName(roomName)
	            , creepRequests: []
	            , controllerId: this.core.room(roomName).controller.id
	            , subActorIds: {}
	            };

	        let subActorNames = [ ACTOR_NAMES.ROOM_REPAIR
	        					, ACTOR_NAMES.ROOM_BUILD
	        					, ACTOR_NAMES.ROOM_HAUL
	        					, ACTOR_NAMES.ROOM_FILL
	        					, ACTOR_NAMES.ROOM_UPGRADE
	        					, ACTOR_NAMES.ROOM_MINE
	        					, ACTOR_NAMES.ROOM_GUARD
	        					, ACTOR_NAMES.ROOM_OFFENSE
	        					];

	        for(let index in subActorNames)
	        	this.memoryObject.subActorIds[subActorNames[index]] =
	        		this.core.createActor(subActorNames[index], (script)=>
						script.initiateActor(this.actorId, roomName) ).id;

	        for(let index in subActorNames)
		        this.core.getActor(this.memoryObject.subActorIds[subActorNames[index]]).lateInitiate();
		}

		resetActor()
		{
			this.core.logWarning("ActorControlledRoom cannot reset without sideeffects to other actors. Use hardReset if nessesary");
		}

		removeActor()
		{
			this.core.unsubscribe(EVENTS.EVERY_TICK, this.actorId);
			super.removeActor();
		}

		requestCreep(request)
		{
			//dirty deduplication
			let requestText = JSON.stringify(request);
			for(let index in this.memoryObject.creepRequests)
				if(JSON.stringify(this.memoryObject.creepRequests[index]) === requestText)
					return;

			this.memoryObject.creepRequests.push(request);
			this.memoryObject.creepRequests.sort((a, b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]); //descending
		}

		requestBuilding(typeProgression, at, priority)
		{
			let roomBuild = this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD]);
			roomBuild.requestBuilding(typeProgression, at, priority);
		}

		requestPickup(at, type)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_HAUL])
				.requestPickup(at, type);

			if(type === RESOURCE_ENERGY)
				this.addEnergyLocation(at);
		}

		requestResource(at, type, priority, amount)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_HAUL])
				.requestResource(at, type, priority, amount);

			if(type === RESOURCE_ENERGY)
				this.addEnergyLocation(at);
		}

		addEnergyLocation(at)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
				.addEnergyLocation(at);

			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD])
				.addEnergyLocation(at);

			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_REPAIR])
				.addEnergyLocation(at);
		}

		buildingCompleted(at, type)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_REPAIR])
				.requestMaintain(at, type);

			switch(type)
			{
				case STRUCTURE_TOWER:
					this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_GUARD])
						.buildingCompleted(at, type);
					this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
						.buildingCompleted(at, type);
					break;
				case STRUCTURE_EXTENSION:
				case STRUCTURE_SPAWN:
					this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
						.buildingCompleted(at, type);
					break;
			}
		}

		onEveryTick()
		{
			let room = this.core.room(this.memoryObject.room.name);

			let spawns = room.find(FIND_MY_SPAWNS);
			let spawn;

			for(let index in spawns)
			{
				if(spawns[index].spawning)
					continue;

				spawn = spawns[index];
				break;
			}

			if(!spawn)
				return;

			if(this.memoryObject.creepRequests.length === 0)
				return;

			let request = this.memoryObject.creepRequests.shift();

			if(room.energyAvailable !== room.energyCapacityAvailable &&
				(!request.energyNeeded || room.energyAvailable < request.energyNeeded))
				return this.memoryObject.creepRequests.unshift(request);
			let actor = this.core.getActor(request.actorId);

			actor[request.functionName](spawn.id, request.callbackObj);
		}
};