"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomBuild extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = this.core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, requests: []
			, currentTask: null
			, pendingCallback: false
			, energyLocations: []
			, subActorId: null
			};

	}

	lateInitiate()
	{
		this.update();
	}

	resetActor()
	{
		let room = this.core.getRoom(this.memoryObject.roomName);

		let sites = room.find(FIND_CONSTRUCTION_SITES);
		for(let index in sites)
			sites[index].remove();

		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject)); //copy

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.subActorId = oldMemory.subActorId;

		this.lateInitiate();

		for(let index in oldMemory.requests)
		{
			let request = oldMemory.requests[index];
			this.requestBuilding(request.typeProgression, request.pos, request.priority);
		}

		for(let index in oldMemory.energyLocations)
			this.addEnergyLocation(oldMemory.energyLocations[index]);
	}

	requestBuilding(typeProgression, at, priority)
	{
		for(let index in this.memoryObject.requests)
		{
			let request = this.memoryObject.requests[index];
			if(request.pos[0] === at[0] && request.pos[1] === at[1] && request.pos[2] === at[2])
				return;
		}

		let rp = this.core.getRoomPosition(at);

		let completeness = -1;

		for(let index = typeProgression.length-1; index >= 0; index--)
		{
			if(rp.lookFor(	LOOK_STRUCTURES,
							{filter: (x)=>x.structureType === typeProgression[index]}).length > 0)
			{
				completeness = index;
				break;
			}
		}

		this.memoryObject.requests.push(
			{ typeProgression: typeProgression
			, pos: at
			, priority: priority
			, completeness: completeness
			});

		if(completeness !== -1)
		{
			let parent = this.core.getActor(this.memoryObject.parentId);
			parent.buildingCompleted(at, typeProgression[completeness]);
		}

		this.memoryObject.requests.sort((a, b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]); //sort decending

		this.update();
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
		this.update();
	}

	update()
	{
		if(this.memoryObject.requests.length === 0 || this.memoryObject.energyLocations.length === 0)
			return;

		if(! this.memoryObject.currentTask)
		{
			this.getNextTask();
			if(! this.memoryObject.currentTask)
				return;
		}
		else
		{
			let pos = this.memoryObject.currentTask.pos;
			let roomPos = new RoomPosition(pos[0], pos[1], pos[2]);
			let structs = roomPos.lookFor(LOOK_STRUCTURES);

			let completed = false;
			for(let index in structs)
				if(structs[index].structureType === this.memoryObject.currentTask.structureType)
				{
					completed = true;
					break;
				}

			if(completed)
			{
				this.memoryObject.requests[this.memoryObject.currentTask.index].completeness =
					this.memoryObject.currentTask.newCompleteness;

				this.getNextTask();
				if(! this.memoryObject.currentTask)
					return;
			}
		}

		let structureType = this.memoryObject.currentTask.structureType;
		let buildPos = this.memoryObject.currentTask.pos;

		if(this.memoryObject.subActorId === null)
		{
			if(this.memoryObject.pendingCallback === true)
				return;

			this.memoryObject.pendingCallback = true;

			this.requestBuilder(
				{ type: structureType
				, at: buildPos
				});

			return;
		}

		let energyPos = this.findNearestEnergyPosition(buildPos);

		let subActor = this.core.getActor(this.memoryObject.subActorId);

		subActor.replaceInstruction(1, [CREEP_INSTRUCTION.PICKUP_AT_POS,        energyPos, RESOURCE_ENERGY   ]);
		subActor.replaceInstruction(2, [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY,    buildPos,  structureType     ]);
		subActor.replaceInstruction(3, [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT, buildPos,  structureType,   6]);
		subActor.setPointer(1);

		let callbackObj = subActor.getCallbackObj();
		callbackObj.at = buildPos;
		callbackObj.type = structureType;
		subActor.setCallbackObj(callbackObj);
	}

	requestBuilder(callbackObj)
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createBuilder"
			, priority: PRIORITY_NAMES.SPAWN.BUILDER
			, callbackObj: callbackObj
			, energyNeeded: 3000
			});
	}

	getNextTask()
	{
		let cachedLookups = {};
		let room = this.core.room(this.memoryObject.roomName);

		for(let requestIndex in this.memoryObject.requests)
		{
			let request = this.memoryObject.requests[requestIndex];
			if(request.completeness + 1 >= request.typeProgression.length)
				continue;

			for(let index = request.typeProgression.length-1 ; index > request.completeness; index--)
			{
				let type = request.typeProgression[index];
				if(! cachedLookups[type])
					cachedLookups[type] = room.find(FIND_STRUCTURES, {filter: (x)=>x.structureType === type}).length;

				if(cachedLookups[type] >= CONTROLLER_STRUCTURES[type][room.controller.level])
					continue;

				this.memoryObject.currentTask =
					{ structureType: type
					, pos: request.pos
					, index: requestIndex
					, newCompleteness: index
					};

				return;
			}
		}

		this.memoryObject.currentTask = null;
	}

	findNearestEnergyPosition(buildPos)
	{
		let energyLocations = _.map(this.memoryObject.energyLocations, (pos)=>new RoomPosition(pos[0], pos[1], pos[2]));
		let buildRoomPos = new RoomPosition(buildPos[0], buildPos[1], buildPos[2]);
		let closest = buildRoomPos.findClosestByPath(energyLocations, {ignoreCreeps: true, ignoreRoads: true});
		return [closest.x, closest.y, closest.roomName];
	}

	createBuilder(spawnId, callbackObj)
	{
		this.memoryObject.pendingCallback = false;

		if(this.memoryObject.subActorId !== null)
			return;

        if(this.memoryObject.currentTask === null)
        {
        	this.update();
        	if(this.memoryObject.currentTask === null)
        		return;
        }

		let body = new this.CreepBodyFactory()
            .addPattern([WORK, CARRY, MOVE, MOVE], 12)
            .setMaxCost(this.core.room(this.memoryObject.roomName).energyCapacityAvailable)
            .fabricate();


		let structureType = this.memoryObject.currentTask.structureType;
		let buildPos = this.memoryObject.currentTask.pos;
		let energyPos = this.findNearestEnergyPosition(buildPos);

		callbackObj.at = buildPos;
		callbackObj.type = structureType;

		let actorObj = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
        	(script)=>script.initiateActor("builder", callbackObj,
        	    [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [spawnId],	body               ] //0
	            , [CREEP_INSTRUCTION.PICKUP_AT_POS,           energyPos,	RESOURCE_ENERGY    ] //1
	            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY,       buildPos,		structureType      ] //2
	            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT,    buildPos,     structureType,    6] //3
	            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,           1             				   ] //4
	            , [CREEP_INSTRUCTION.GOTO,                    7             				   ] //5
	            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId, "buildCompleted"   ] //6
	            , [CREEP_INSTRUCTION.RECYCLE_CREEP                          				   ] //7
	            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId, "builderDied"      ] //8
	            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                          ] ] //9
        ));

		this.memoryObject.subActorId = actorObj.id;
	}

	builderDied(callbackObj)
	{
		this.memoryObject.subActorId = null;
		this.requestBuilder(callbackObj);
	}

	buildCompleted(callbackObj)
	{
		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.buildingCompleted(callbackObj.at, callbackObj.type);

		this.update();
	}
};