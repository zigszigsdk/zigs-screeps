"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomFill extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let scoring = roomScoring.getRoom(roomName);

		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, extensions: scoring.flower.extension
			, spawns: scoring.flower.spawn
			, links: scoring.flower.link
			, containers: scoring.flower.container
			, storages: scoring.flower.storage
			, roads: scoring.flower.road
			, towers: scoring.flower.tower
			, energyLocations: []
			};

		let parent = this.core.getActor(parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.FILLER
			});

		for(let index in scoring.flower.extension)
			parent.requestBuilding([STRUCTURE_EXTENSION], scoring.flower.extension[index], PRIORITY_NAMES.BUILD.EXTENSION);

		for(let index in scoring.flower.spawn)
			parent.requestBuilding([STRUCTURE_SPAWN], scoring.flower.spawn[index], PRIORITY_NAMES.BUILD.SPAWN);

		for(let index in scoring.flower.link)
			parent.requestBuilding([STRUCTURE_LINK], scoring.flower.link[index], PRIORITY_NAMES.BUILD.FLOWER_LINK);

		for(let index in scoring.flower.container)
			parent.requestBuilding([STRUCTURE_CONTAINER], scoring.flower.container[index], PRIORITY_NAMES.BUILD.FLOWER_CONTAINER);

		for(let index in scoring.flower.storage)
			parent.requestBuilding([STRUCTURE_STORAGE], scoring.flower.storage[index], PRIORITY_NAMES.BUILD.STORAGE);

		for(let index in scoring.flower.road)
			parent.requestBuilding([STRUCTURE_ROAD], scoring.flower.road[index], PRIORITY_NAMES.BUILD.FLOWER_ROAD);

		//don't request towers. let ROOM_GUARD take care of that.
	}

	addEnergyLocation(at)
	{
		for(let index in this.memoryObject.energyLocations)
		{
			let location = this.memoryObject.energyLocations[index];

			if(location[0] === at[0] && location[1] === at[1] && location[2] === at[2])
				return;
		}

		this.memoryObject.energyLocations.push(at);
	}

	createFiller(spawnId)
	{
		let spawn = this.core.getObjectById(spawnId);

		let energyPoint;
		let bestScore = Number.NEGATIVE_INFINITY;

		for(let index in this.memoryObject.energyLocations)
		{
			let candidate = this.memoryObject.energyLocations[index];
			let score = - spawn.pos.findPathTo(candidate[0], candidate[1], candidate[2]).length;

			if(score <= bestScore)
				continue;

			bestScore = score;
			energyPoint = candidate;
		}

		let getId = (list) => _.map(list, (item)=>item.id);

		let towers = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.TOWERS));
		let extensions = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.EXTENSIONS));
		let spawns = getId(spawn.room.find(FIND_STRUCTURES, FILTERS.SPAWNS));

		let body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
		this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP, (script)=>script.initiateActor("filler", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,         [spawnId],   		body            ] //0
            , [CREEP_INSTRUCTION.PICKUP_AT_POS,               energyPoint,      RESOURCE_ENERGY ] //1
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  towers          ] //2
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  extensions      ] //3
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  spawns  		] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,               1                 				] //5
            , [CREEP_INSTRUCTION.CALLBACK,                    this.actorId,     "fillerDied"    ] //6
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                 			  ] ] //7
        ));
	}

	fillerDied()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.FILLER
			});
	}

};