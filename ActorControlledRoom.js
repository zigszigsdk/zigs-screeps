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

	        this.memoryObject =
	            { room: mapCalc.parseRoomName(roomName)
	            , creepRequests: []
	            , controllerId: this.core.getRoom(roomName).controller.id
	            , subActorIds: {}
	            };

	        this.core.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

	        let subActorNames = [ ACTOR_NAMES.ROOM_REPAIR
	        					, ACTOR_NAMES.ROOM_BUILD
	        					, ACTOR_NAMES.ROOM_HAUL
	        					, ACTOR_NAMES.ROOM_FILL
	        					, ACTOR_NAMES.ROOM_UPGRADE
	        					, ACTOR_NAMES.ROOM_MINE_ENERGY
	        					, ACTOR_NAMES.ROOM_MINE_MINERAL
	        					, ACTOR_NAMES.ROOM_STORAGE_KEEPER
	        					, ACTOR_NAMES.ROOM_GUARD
	        					, ACTOR_NAMES.ROOM_OFFENSE
	        					, ACTOR_NAMES.ROOM_EXPLORE
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
			this.core.logWarning(
				"ActorControlledRoom cannot reset without sideeffects to other actors. Use hardReset if nessesary");
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

		removeAllBuildingRequestsWithType(type)
		{
			let roomBuild = this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD]);
			roomBuild.removeAllRequestsWithType(type);
		}

		requestResource(request)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_HAUL])
				.requestResource(request);
		}

		registerEnergyLocation(request)
		{
			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
				.addEnergyLocation(request);

			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD])
				.addEnergyLocation(request);

			this.core.getActor(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_REPAIR])
				.addEnergyLocation(request);
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
			let room = this.core.getRoom(this.memoryObject.room.name);

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