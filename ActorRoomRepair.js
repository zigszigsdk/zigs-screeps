"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomRepair extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, maintainRequests: []
			, creepRequested: false
			, subActorId: null
			, energyLocations: []
			, jobs: []
			, jobPointer: 0
			};
	}

	requestMaintain(at, type)
	{
		this.memoryObject.maintainRequests.push(
			{ at: at
			, type: type
			}
		);
		this.update();
	}

	addEnergyLocation(at)
	{
		this.memoryObject.energyLocations.push(at);
		this.update();
	}

	update()
	{
		if(this.memoryObject.maintainRequests.length === 0 || this.memoryObject.energyLocations.length === 0)
			return;

		this.memoryObject.jobPointer = 0;

		this.memoryObject.jobs = [];

		for(let maintainIndex in this.memoryObject.maintainRequests)
		{
			let maintainRequest = this.memoryObject.maintainRequests[maintainIndex];
			let maintainRoomPos = this.core.getRoomPosition(maintainRequest.at);

			let bestScore = Number.NEGATIVE_INFINITY;
			let energyLocation = null;

			for(let energyIndex in this.memoryObject.energyLocations)
			{
				let candidate = this.memoryObject.energyLocations[energyIndex];

				let score = - maintainRoomPos.findPathTo(candidate[0], candidate[1], candidate[2]).length;

				if(score <= bestScore)
					continue;

				bestScore = score;
				energyLocation = candidate;
			}

			this.memoryObject.jobs.push(
				{ maintainAt: maintainRequest.at
				, maintainType: maintainRequest.type
				, energyAt: energyLocation
				}
			);
		}

		if(this.memoryObject.subActorId !== null)
			return this.updateSubActor();

		this.requestCreep();
	}

	requestCreep()
	{
		if(this.memoryObject.creepRequested === true)
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createFixer"
			, priority: PRIORITIES.SPAWN.FIXER
			}
		);

		this.memoryObject.creepRequested = true;
	}

	createFixer(spawnId)
	{
        let energy = this.core.getRoom(this.memoryObject.roomName).energyCapacityAvailable;

        let body = new this.CreepBodyFactory()
            .addPattern([MOVE, CARRY, WORK], 1)
            .setMaxCost(energy)
            .fabricate();

        let job = this.memoryObject.jobs[this.memoryObject.jobPointer];

		let actorRes = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor("fixer", {},
	            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,	[spawnId], 		body 					] //0
	            , [CREEP_INSTRUCTION.PICKUP_AT_POS, 		job.energyAt, 	RESOURCE_ENERGY			] //1
	            , [CREEP_INSTRUCTION.FIX_AT, 				job.maintainAt, job.maintainType 		] //2
	            , [CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED, 	job.maintainAt, job.maintainType,	1	] //3
	            , [CREEP_INSTRUCTION.CALLBACK, 				this.actorId, 	"repairComplete"		] //4
	            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 		1										] //5
	            , [CREEP_INSTRUCTION.CALLBACK, 				this.actorId, 	"fixerDied"				] //6
	            , [CREEP_INSTRUCTION.DESTROY_SCRIPT												  ] ] //7
        	)
        );

		this.memoryObject.creepRequested = false;
        this.memoryObject.subActorId = actorRes.id;
	}

	repairComplete()
	{
		this.memoryObject.jobPointer++;

		if(this.memoryObject.jobPointer === this.memoryObject.jobs.length)
			this.memoryObject.jobPointer = 0;

		let subActor = this.core.getActor(this.memoryObject.subActorId);

        let job = this.memoryObject.jobs[this.memoryObject.jobPointer];

		subActor.replaceInstruction(1, [CREEP_INSTRUCTION.PICKUP_AT_POS, 	 job.energyAt, 	 RESOURCE_ENERGY	]);
		subActor.replaceInstruction(2, [CREEP_INSTRUCTION.FIX_AT, 			 job.maintainAt, job.maintainType 	]);
	    subActor.replaceInstruction(3, [CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED, job.maintainAt, job.maintainType, 1]);
	}

	fixerDied()
	{
		this.memoryObject.subActorId = null;
		this.requestCreep();
	}
};