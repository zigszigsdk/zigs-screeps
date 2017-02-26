"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorAdhocHauler extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = this.core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(fromPos, toPos, type, controlledRoomId, creepSize)
	{
		this.memoryObject =
			{ fromPos: fromPos
			, toPos: toPos
			, type: type
			, controlledRoomId: controlledRoomId
			, creepSize: creepSize
			};

		this.requestCreep();
	}


	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.fromPos, oldMemory.toPos, oldMemory.type, oldMemory.controlledRoomId, oldMemory.size);
	}


	requestCreep()
	{
		let controlledRoom = this.core.getActor(this.memoryObject.controlledRoomId);

		controlledRoom.requestCreep(
			{ actorId: this.actorId
			, functionName: "createCreep"
			, priority: PRIORITY_NAMES.SPAWN.ADHOC
			, energyNeeded: 100 * this.memoryObject.creepSize
			});
	}

	createCreep(spawnId)
	{
		let body = new this.CreepBodyFactory()
            .addPattern([MOVE, CARRY], this.memoryObject.creepSize)
            .setMaxCost(this.core.getObjectById(spawnId).room.energyCapacityAvailable)
            .fabricate();

		this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
        	(script)=>script.initiateActor("adhocHauler", {},
        	    [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,   [spawnId],					body					] //0
	            , [CREEP_INSTRUCTION.PICKUP_AT_POS,         this.memoryObject.fromPos,	this.memoryObject.type	] //1
	            , [CREEP_INSTRUCTION.DEPOSIT_AT,       		this.memoryObject.toPos,	this.memoryObject.type	] //2
	            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,       	1      												] //3
	            , [CREEP_INSTRUCTION.CALLBACK,             	this.actorId,				"creepDied"      		] //4
	            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                        					  ] ] //5
        ));
	}

	creepDied(callbackObj)
	{
		this.removeActor();
	}
};