"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomOffense extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			};
	}

	lateInitiate()
	{
		this.requestCreep();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		this.lateInitiate();
	}

	requestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createDismantler"
			, priority: PRIORITY_NAMES.SPAWN.OFFENSE
			, energyNeeded: 7350
			}
		);
	}

	createDismantler(spawnId)
	{
		let targetKeys = Object.keys(Game.flags);

		if(targetKeys.length === 0)
			return;

		let targetPos = Game.flags[targetKeys[0]].pos;

		let energy = this.core.getRoom(this.memoryObject.roomName).energyCapacityAvailable;

		let body = new this.CreepBodyFactory()
			.addPattern([WORK, MOVE], 1)
			.addPattern([TOUGH], 48)
			.addReplace(TOUGH, MOVE, 24)
			.addReplace(TOUGH, HEAL, 24)
			.setSort([TOUGH, MOVE, HEAL, WORK])
			.setMaxCost(energy)
			.fabricate();


		this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor("soloDismantler", {},
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //0
			, [CREEP_INSTRUCTION.DISMANTLE_AT, targetPos] //1
			, [CREEP_INSTRUCTION.GOTO_IF_DEAD, 4] //2
			, [CREEP_INSTRUCTION.REMOVE_FLAG_AT, targetPos] //3
			, [CREEP_INSTRUCTION.RECYCLE_CREEP] //4
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ] //5
			));

		this.requestCreep();
	}
};