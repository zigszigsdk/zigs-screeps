"use strict";

let ActorWithMemory = require('ActorWithMemory');

let ENERGY_LIMIT = 250;

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

		this.core.subscribe(EVENTS.ROOM_LEVEL_CHANGED + roomName, this.actorId, "onRoomLevelChange");
	}

	onRoomLevelChange()
	{
		this.update();
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
			if(
				(
					(
						request.typeProgression[0] === typeProgression[0]
					) ||
					(	typeProgression[0] !== STRUCTURE_ROAD &&
						typeProgression[0] !== STRUCTURE_RAMPART &&
						request.typeProgression[0] !== STRUCTURE_ROAD &&
						request.typeProgression[0] !== STRUCTURE_RAMPART
					)
				) &&
				request.pos[0] === at[0] && request.pos[1] === at[1] && request.pos[2] === at[2])
				{
					this.memoryObject.requests[index] = this._parseRequest(typeProgression, at, priority);
					this.memoryObject.requests.sort((a, b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]);
					this.update();
					return;
				}
		}

		let newRequest = this._parseRequest(typeProgression, at, priority);
		this.memoryObject.requests.push(newRequest);

		if(newRequest.completeness !== -1)
		{
			let parent = this.core.getActor(this.memoryObject.parentId);
			parent.buildingCompleted(at, typeProgression[newRequest.completeness]);
		}

		this.memoryObject.requests.sort((a, b) => PRIORITIES[b.priority] - PRIORITIES[a.priority]); //sort decending

		this.update();
	}

	removeAllRequestsWithType(type)
	{
		for(let requestIndex = this.memoryObject.requests.length-1; requestIndex >= 0; requestIndex--)
		{
			let typeAt = this.memoryObject.requests[requestIndex].typeProgression.indexOf(type);

			if(typeAt === -1)
				continue;

			this.memoryObject.requests.splice(requestIndex, 1);
		}

		this.memoryObject.currentTask = null;

		this.update();
	}

	_parseRequest(typeProgression, at, priority)
	{
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

		return 	{ typeProgression: typeProgression
				, pos: at
				, priority: priority
				, completeness: completeness
				};
	}

	addEnergyLocation(energyRequest)
	{
		for(let index in this.memoryObject.energyLocations)
		{
			let existingRequest = this.memoryObject.energyLocations[index];

			if(existingRequest.at[0] === energyRequest.at[0] &&
				existingRequest.at[1] === energyRequest.at[1] &&
				existingRequest.at[2] === energyRequest.at[2])
			{
				return;
			}
		}

		this.memoryObject.energyLocations.push(energyRequest);

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

		subActor.replaceInstruction(1, [CREEP_INSTRUCTION.PICKUP_AT_POS,        energyPos, RESOURCE_ENERGY, ENERGY_LIMIT]);
		subActor.replaceInstruction(2, [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY,    buildPos,  structureType     			]);
		subActor.replaceInstruction(3, [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT, buildPos,  structureType,   6			]);
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
		let room = this.core.getRoom(this.memoryObject.roomName);

		for(let requestIndex in this.memoryObject.requests)
		{
			let request = this.memoryObject.requests[requestIndex];
			request.completeness = -1;

			let roomPosition = this.core.getRoomPosition(request.pos);
			let structs = roomPosition.lookFor(LOOK_STRUCTURES);

			for(let progressionIndex = request.typeProgression.length-1; progressionIndex >= 0; progressionIndex--)
			{
				let found = false;

				for(let structIndex = 0; structIndex < structs.length; structIndex++)
					if(structs[structIndex].structureType === request.typeProgression[progressionIndex])
					{
						found = true;
						break;
					}

				if(!found)
					continue;

				request.completeness = progressionIndex;
				break;
			}


			this.memoryObject.requests[requestIndex] = request;

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
		let energyRps = _.map(this.memoryObject.energyLocations, (r)=>new RoomPosition(r.at[0], r.at[1], r.at[2]));
		let buildRoomPos = new RoomPosition(buildPos[0], buildPos[1], buildPos[2]);
		let closest = buildRoomPos.findClosestByPath(energyRps, {ignoreCreeps: true, ignoreRoads: true});
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
            .addPattern([WORK, CARRY, MOVE, MOVE], 5)
            .setMaxCost(this.core.getRoom(this.memoryObject.roomName).energyCapacityAvailable)
            .fabricate();


		let structureType = this.memoryObject.currentTask.structureType;
		let buildPos = this.memoryObject.currentTask.pos;
		let energyPos = this.findNearestEnergyPosition(buildPos);

		callbackObj.at = buildPos;
		callbackObj.type = structureType;

		let actorObj = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
        	(script)=>script.initiateActor("builder", callbackObj,
        	    [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [spawnId],	body               				] //0
	            , [CREEP_INSTRUCTION.PICKUP_AT_POS,           energyPos,	RESOURCE_ENERGY,  ENERGY_LIMIT	] //1
	            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY,       buildPos,		structureType      				] //2
	            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT,    buildPos,     structureType,    6				] //3
	            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,           1             				   				] //4
	            , [CREEP_INSTRUCTION.GOTO,                    7             				   				] //5
	            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId, "buildCompleted"   				] //6
	            , [CREEP_INSTRUCTION.RECYCLE_CREEP                          				   				] //7
	            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId, "builderDied"      				] //8
	            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                        				  ] ] //9
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

		let structs = this.core.getRoomPosition(callbackObj.at).lookFor(LOOK_STRUCTURES);
		for(let index in structs)
		{
			if(structs[index].structureType !== callbackObj.type)
				continue;

			parent.buildingCompleted(callbackObj.at, callbackObj.type);
			this.core.subscribe(EVENTS.STRUCTURE_DESTROYED + structs[index].id, this.actorId, "onStructureDestroyed");
			break;
		}


		this.update();
	}

	onStructureDestroyed()
	{
		this.update();
	}
};