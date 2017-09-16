"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorControlledRoom extends ActorWithMemory
{
		constructor(locator)
		{
			super(locator);
			this.mapCalc = locator.getService(SERVICE_NAMES.MAP_CALC);
			this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
			this.events = locator.getService(SERVICE_NAMES.EVENTS);
			this.actors = locator.getService(SERVICE_NAMES.ACTORS);
			this.logger = locator.getService(SERVICE_NAMES.LOGGER);
		}

		initiateActor(roomName)
		{
			this.memoryObject =
				{ room: this.mapCalc.parseRoomName(roomName)
				, creepRequests: []
				, controllerId: this.screepsApi.getRoom(roomName).controller.id
				, subActorIds: {}
				};

			this.events.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

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
								, ACTOR_NAMES.ROOM_LINK
								];

			for(let index in subActorNames)
				this.memoryObject.subActorIds[subActorNames[index]] =
					this.actors.create(subActorNames[index], (script)=>
						script.initiateActor(this.actorId, roomName) ).id;

			for(let index in subActorNames)
				this.actors.get(this.memoryObject.subActorIds[subActorNames[index]]).lateInitiate();
		}

		resetActor()
		{
			this.logger.warning(
				"ActorControlledRoom cannot reset without sideeffects to other actors. Use hardReset if nessesary");
		}

		removeActor()
		{
			this.events.unsubscribe(EVENTS.EVERY_TICK, this.actorId);
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

		requestBuilding(typeProgression, at, priority, minRoomLevel)
		{
			let roomBuild = this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD]);
			roomBuild.requestBuilding(typeProgression, at, priority, minRoomLevel);
		}

		removeAllBuildingRequestsWithType(type)
		{
			let roomBuild = this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD]);
			roomBuild.removeAllRequestsWithType(type);
		}

		requestResource(request)
		{
			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_HAUL])
				.requestResource(request);
		}

		removeResourceRequestsAt(at)
		{
			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_HAUL])
				.removeRequestsAt(at);
		}

		registerEnergyLocation(request)
		{
			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
				.addEnergyLocation(request);

			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_BUILD])
				.addEnergyLocation(request);

			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_REPAIR])
				.addEnergyLocation(request);
		}

		buildingCompleted(at, type)
		{
			this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_REPAIR])
				.requestMaintain(at, type);

			switch(type)
			{
				case STRUCTURE_TOWER:
					this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_GUARD])
						.buildingCompleted(at, type);
					this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
						.buildingCompleted(at, type);
					break;
				case STRUCTURE_EXTENSION:
				case STRUCTURE_SPAWN:
					this.actors.get(this.memoryObject.subActorIds[ACTOR_NAMES.ROOM_FILL])
						.buildingCompleted(at, type);
					break;
			}
		}

		onEveryTick()
		{
			let room = this.screepsApi.getRoom(this.memoryObject.room.name);

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
			let actor = this.actors.get(request.actorId);

			actor[request.functionName](spawn.id, request.callbackObj);
		}
};