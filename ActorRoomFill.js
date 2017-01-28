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
			, subActorId: null
			};

	}

	lateInitiate()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.FILLER
			, energyNeeded: 300
			});

		for(let index in this.memoryObject.extensions)
			parent.requestBuilding([STRUCTURE_EXTENSION], this.memoryObject.extensions[index], PRIORITY_NAMES.BUILD.EXTENSION);

		for(let index in this.memoryObject.spawns)
			parent.requestBuilding([STRUCTURE_SPAWN], this.memoryObject.spawns[index], PRIORITY_NAMES.BUILD.SPAWN);

		for(let index in this.memoryObject.links)
			parent.requestBuilding([STRUCTURE_LINK], this.memoryObject.links[index], PRIORITY_NAMES.BUILD.FLOWER_LINK);

		for(let index in this.memoryObject.containers)
			parent.requestBuilding([STRUCTURE_CONTAINER], this.memoryObject.containers[index], PRIORITY_NAMES.BUILD.FLOWER_CONTAINER);

		for(let index in this.memoryObject.storages)
			parent.requestBuilding([STRUCTURE_STORAGE], this.memoryObject.storages[index], PRIORITY_NAMES.BUILD.STORAGE);

		for(let index in this.memoryObject.roads)
			parent.requestBuilding([STRUCTURE_ROAD], this.memoryObject.roads[index], PRIORITY_NAMES.BUILD.FLOWER_ROAD);

		//don't request towers. let ROOM_GUARD take care of that.
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.subActorId = null;//oldMemory.subActorId;

		for(let index in oldMemory.energyLocations)
			this.addEnergyLocation(oldMemory.energyLocations[index]);

		this.lateInitiate();
	}

	buildingCompleted(at, type)
	{
		if(this.memoryObject.subActorId === null)
			return;

		let subActor = this.core.getActor(this.memoryObject.subActorId);

		let room = this.core.getRoom(this.memoryObject.roomName);

		let getId = (list) => _.map(list, (item)=>item.id);
		let towers = getId(room.find(FIND_STRUCTURES, FILTERS.TOWERS));
		let extensions = getId(room.find(FIND_STRUCTURES, FILTERS.EXTENSIONS));
		let spawns = getId(room.find(FIND_STRUCTURES, FILTERS.SPAWNS));

		subActor.replaceInstruction(2, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, towers]);
		subActor.replaceInstruction(3, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, extensions]);
		subActor.replaceInstruction(4, [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY, RESOURCE_ENERGY, spawns]);
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

		let energy = this.core.room(this.memoryObject.roomName).energyAvailable;

		let body = new this.CreepBodyFactory()
            .addPattern([CARRY, MOVE], 25)
            .setSort([CARRY, MOVE])
            .setMaxCost(energy)
            .fabricate();

		let result = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP, (script)=>script.initiateActor("filler", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,         [spawnId],   		body            ] //0
            , [CREEP_INSTRUCTION.PICKUP_AT_POS,               energyPoint,      RESOURCE_ENERGY ] //1
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  towers          ] //2
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  extensions      ] //3
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,  spawns  		] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,               1                 				] //5
            , [CREEP_INSTRUCTION.CALLBACK,                    this.actorId,     "fillerDied"    ] //6
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                 			  ] ] //7
        ));

        this.memoryObject.subActorId = result.id;
	}

	fillerDied()
	{
		this.memoryObject.subActorId = null;
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFiller"
			, priority: PRIORITY_NAMES.SPAWN.FILLER
			, energyNeeded: 300
			});
	}

};