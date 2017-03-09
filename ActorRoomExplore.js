"use strict";

const ActorWithMemory = require('ActorWithMemory');
const ROLE_NAME = "Explorer";

module.exports = class ActorRoomExplore extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.mapSearch = core.getService(SERVICE_NAMES.MAP_SEARCH);
		this.mapStatus = core.getService(SERVICE_NAMES.MAP_STATUS);
		this.mapCalc = core.getService(SERVICE_NAMES.MAP_CALC);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, isExplorerInRoomName: {}
			, nextRoomName: roomName
			, subActorIds: []
			, roomsForRespawn: []
			};
	}

	lateInitiate()
	{
		this._setupNextRoom();
		this._requestCreep();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		for(let index in oldMemory.subActorIds)
			this.core.removeActor(oldMemory.subActorIds[index]);

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.lateInitiate();
	}

	_setupNextRoom()
	{
		this.memoryObject.isExplorerInRoomName[this.memoryObject.nextRoomName] = true;

		let isExplorerInRoomName = this.memoryObject.isExplorerInRoomName;

		this.memoryObject.nextRoomName =
			this.mapSearch.searchBreadthFirst(
				this.memoryObject.roomName,
				(room)=> isExplorerInRoomName[room.roomName] !== true,
				(room)=> room.roomName,
				(roomName) =>
					(!IN_NOVICEAREA || this.mapCalc.IsRoomInsideArea(roomName, NOVICEAREA_BOX)) &&
					!this.mapStatus.isBelongingToEnemy(roomName));
	}

	_requestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "spawnExplorer"
			, priority: PRIORITY_NAMES.SPAWN.EXPLORER
			, energyNeeded: 50
			});
	}

	spawnExplorer(spawnId)
	{
		return;
		if(this.memoryObject.nextRoomName === null)
			return;

		let result = this._createSubactor(spawnId, this.memoryObject.nextRoomName);

		this.memoryObject.subActorIds.push(result.id);

		this._setupNextRoom();
	}

	_reRequestCreep()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "respawnExplorer"
			, priority: PRIORITY_NAMES.SPAWN.EXPLORER
			, energyNeeded: 50
			});
	}

	respawnExplorer(spawnId)
	{
		return;
		if(this.memoryObject.roomsForRespawn.length === 0)
			return;

		let result = this._createSubactor(spawnId, this.memoryObject.roomsForRespawn.shift());

		this.memoryObject.subActorIds.push(result.id);
	}

	_createSubactor(spawnId, roomName)
	{
		let body = [MOVE];

		let callbackObj = {roomName: roomName};

		let instructions =
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //0
			, [CREEP_INSTRUCTION.MOVE_TO_ROOM, roomName, true] //1
			, [CREEP_INSTRUCTION.GOTO_IF_DEAD, 7] //2
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "explorerArrived"] //3
			, [CREEP_INSTRUCTION.WAIT_UNTIL_DEATH] //4
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "explorerDiedAfterArrival"] //5
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] //6
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "explorerDiedBeforeArrival"] //7
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ];//8

		return this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor(ROLE_NAME, callbackObj, instructions));
	}

	explorerArrived(callbackObj)
	{
		this.mapStatus.findAndSetStatusOfRoom(callbackObj.roomName);
		this._startNextMove();
	}

	explorerDiedAfterArrival(callbackObj, subActorId)
	{
		this._removeSubactor(subActorId);
		this.memoryObject.roomsForRespawn.push(callbackObj.roomName);
	}

	explorerDiedBeforeArrival(callbackObj, subActorId)
	{
		this.mapStatus.setBelongingToEnemy(callbackObj.roomName);

		this._removeSubactor(subActorId);
		this.memoryObject.roomsForRespawn.push(callbackObj.roomName);

		this._startNextMove();
	}

	_startNextMove()
	{
		if(this.memoryObject.nextRoomName)
			this._requestCreep();
		else if(this.memoryObject.roomsForRespawn.length !== 0)
			this._reRequestCreep();
	}

	_removeSubactor(subActorId)
	{
		let index = this.memoryObject.subActorIds.indexOf(subActorId);
		if(index !== -1)
			this.memoryObject.subActorIds.splice(index, 1);

	}
};