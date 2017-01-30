"use strict";

let ActorWithMemory = require('ActorWithMemory');

const TARGET_WORKPARTS = 15;
const MAX_CREEPS = 3;
const TARGET_RESOURCE_RESERVE = 1500;

module.exports = class ActorRoomUpgrade extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let upgradeContainerPos = roomScoring.getRoom(roomName).upgradeContainer;

		let room = this.core.room(roomName);

		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, workParts: 0
			, energyPos: upgradeContainerPos
			, controllerId: room.controller.id
			, creepCount: 0
			};
	}

	lateInitiate()
	{

		let parent = this.core.getActor(this.memoryObject.parentId);


		parent.requestBuilding(	[STRUCTURE_CONTAINER, STRUCTURE_LINK],
								this.memoryObject.energyPos,
								PRIORITY_NAMES.BUILD.UPGRADER_CONTAINER);

		parent.requestResource(
			new this.ResourceRequest(this.memoryObject.energyPos, RESOURCE_ENERGY)
					.setPriorityName(PRIORITY_NAMES.RESOURCE.UPGRADE)
					.setRate(-15)
					.setDesired(TARGET_RESOURCE_RESERVE)
					.setMin(250)
					.fabricate());

		this.requestCreep();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.workParts = oldMemory.workParts;
		this.lateInitiate();
	}

	requestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createUpgrader"
			, priority: PRIORITY_NAMES.SPAWN.UPGRADER
			, energyNeeded: 2000
			});
	}

	createUpgrader(spawnId)
	{
		if(this.memoryObject.workParts >= TARGET_WORKPARTS)
			return;

		let energy = this.core.room(this.memoryObject.roomName).energyCapacityAvailable;

        let body = new this.CreepBodyFactory()
            .addPattern([CARRY, WORK, MOVE], 1)
            .addPattern([WORK], TARGET_WORKPARTS-1)
            .addPattern([MOVE], TARGET_WORKPARTS-1)
            .addPattern([CARRY], TARGET_WORKPARTS/2 -1)
            .setSort([MOVE, CARRY, WORK])
            .setMaxCost(energy)
            .fabricate();

        let workParts = 0;

        for(let index in body)
        	if(body[index] === WORK)
        		workParts++;

        this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor("upgrader", {workParts: workParts},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,	[spawnId], 						body 					] //0
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, 		this.memoryObject.energyPos,	RESOURCE_ENERGY,	500 ] //1
            , [CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY, 	this.memoryObject.controllerId 							] //2
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 		1 														] //3
            , [CREEP_INSTRUCTION.CALLBACK, 				this.actorId,					"upgraderDied" 			] //4
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT 													  		  ] ] //5
            ));

        this.memoryObject.creepCount++;
		this.memoryObject.workParts += workParts;

        if(this.memoryObject.workParts < TARGET_WORKPARTS && this.memoryObject.creepCount < MAX_CREEPS)
			this.requestCreep();
	}

	upgraderDied(callbackObj)
	{
		this.memoryObject.creepCount--;
		this.memoryObject.workParts -= callbackObj.workParts;

		if(this.memoryObject.workParts < TARGET_WORKPARTS && this.memoryObject.creepCount < MAX_CREEPS)
			this.requestCreep();
	}
};