 "use strict";

const MAX_ENERGY_NEEDED = 750;
const ROLE_NAME = "mineralMiner";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMineMineral extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);

		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, mineral: roomScoring.getRoom(roomName).mineral
			, subActorId: null
			};

	}

	lateInitiate()
	{
		if(isUndefinedOrNull(this.memoryObject.mineral))
			return this.core.removeActor(this.actorId);

		let room = this.core.getRoom(this.memoryObject.roomName);
		if(room.controller.level >= LEVEL_REQUIRED_TO_MINE_MINERALS)
			this._requestMiner();
		else
			this.core.subscribe(EVENTS.ROOM_LEVEL_CHANGED + this.memoryObject.roomName, this.actorId, "onRoomLevelChanged");

		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestBuilding(	[STRUCTURE_CONTAINER],
								this.memoryObject.mineral.miningSpot,
								PRIORITY_NAMES.BUILD.MINERAL_MINING_CONTAINER);

		let mineral = this.core.getObjectById(this.memoryObject.mineral.id);
		let mineralPosArr = [mineral.pos.x, mineral.pos.y, mineral.pos.roomName];

		parent.requestBuilding(	[STRUCTURE_EXTRACTOR],
								mineralPosArr,
								PRIORITY_NAMES.BUILD.MINERAL_EXTRACTOR);

		parent.requestResource(
			new this.ResourceRequest(this.memoryObject.mineral.miningSpot, mineral.mineralType)
				.setPriorityName(PRIORITY_NAMES.RESOURCE.MINERAL)
				.setRate(5)
				.setDesired(0)
				.setMin(0)
				.setParking(this.memoryObject.mineral.parkingSpot)
				.fabricate());
	}

	onRoomLevelChanged()
	{
		let room = this.core.getRoom(this.memoryObject.roomName);
		if(room.controller.level >= LEVEL_REQUIRED_TO_MINE_MINERALS)
		{
			this._requestMiner();
			this.core.unsubscribe(EVENTS.ROOM_LEVEL_CHANGED + this.memoryObject.roomName, this.actorId);
		}
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.subActorId = oldMemory.subActorId;

		this.lateInitiate();
	}

	_requestMiner()
	{
		if(this.memoryObject.subActorId !== null)
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.MINERAL_MINER
			, energyNeeded: MAX_ENERGY_NEEDED
			});
	}

	createMiner(spawnId)
	{
		if(this.memoryObject.subActorId !== null)
			return;

		let room = this.core.getRoom(this.memoryObject.roomName);
        let energy = room.energyAvailable;

        let	body = new this.CreepBodyFactory()
	            .addPattern([MOVE], 1)
	            .addPattern([WORK], 5)
	            .addPattern([MOVE], 4)
	            .setSort([MOVE, WORK])
	            .setMaxCost(energy)
	            .fabricate();

	    let mineralId = this.memoryObject.mineral.id;
        let miningSpot = this.memoryObject.mineral.miningSpot;

		let result = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor(ROLE_NAME, {},
	            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [spawnId],	body            ]   //0
    	        , [CREEP_INSTRUCTION.MOVE_TO_POSITION,        miningSpot                 	]   //1
        	    , [CREEP_INSTRUCTION.MINE_UNTIL_DEATH,        mineralId                     ]   //2
            	, [CREEP_INSTRUCTION.CALLBACK,                this.actorId,	"minerDied"     ]   //3
            	, [CREEP_INSTRUCTION.DESTROY_SCRIPT 									  ] ]));//4

		this.memoryObject.subActorId = result.id;
	}

	minerDied(callbackObj)
	{
		this.memoryObject.subActorId = null;
		this._requestMiner();
	}


};