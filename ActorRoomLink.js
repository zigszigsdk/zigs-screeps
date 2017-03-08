"use strict";

const ActorWithMemory = require('ActorWithMemory');
const LINK_MAX_TRANSFER_FILL = 799;

module.exports = class ActorRoomLink extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, mineLinkIds: null
			, storageLinkIds: null
			, upgraderLinkId: null
			, flowerLinkId: null
			};

		this.core.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");
		this.core.subscribe(EVENTS.STRUCTURE_BUILD	 + roomName, this.actorId, "onStructureUpdate");
		this.core.subscribe(EVENTS.STRUCTURE_DESTROYED + roomName, this.actorId, "onStructureUpdate");

		this._updateLinkIds();
	}

	lateInitiate(){}

	onStructureUpdate()
	{
		this._updateLinkIds();
	}

	_updateLinkIds()
	{
		let core = this.core;
		let findAt = function(posArr, structureType)
		{
			let results = _.filter(core.getRoomPosition(posArr).lookFor(LOOK_STRUCTURES),
				(x)=>x.structureType === structureType);
			if(results.length === 0)
				return null;
			return results[0];
		};

		let layout = this.core.getService(SERVICE_NAMES.ROOM_SCORING).getRoom(this.memoryObject.roomName);

		let flowerLink = findAt(layout.flower.link[0], STRUCTURE_LINK);
		this.memoryObject.flowerLinkId = flowerLink === null ? null : flowerLink.id;

		let upgraderLink = findAt(layout.upgrade.container, STRUCTURE_LINK);
		this.memoryObject.upgraderLinkId = upgraderLink === null ? null : upgraderLink.id;

		this.memoryObject.storageLinkIds = [];
		for(let index in layout.storage.link)
		{
			let link = findAt(layout.storage.link[index], STRUCTURE_LINK);
			if(link !== null)
				this.memoryObject.storageLinkIds.push(link.id);
		}

		this.memoryObject.mineLinkIds = [];
		for(let index in layout.mines)
		{
			let link = findAt(layout.mines[index].linkSpot, STRUCTURE_LINK);
			if(link !== null)
				this.memoryObject.mineLinkIds.push(link.id);
		}
	}

	onEveryTick()
	{
		let flowerLink = this.core.getObjectFromId(this.memoryObject.flowerLinkId);
		let upgraderLink = this.core.getObjectFromId(this.memoryObject.upgraderLinkId);

		for(let index in this.memoryObject.mineLinkIds)
		{
			let mineLink = this.core.getObjectFromId(this.memoryObject.mineLinkIds[index]);

			if(isNullOrUndefined(mineLink) || mineLink.cooldown !== 0)
				continue;

			if(!isNullOrUndefined(flowerLink) && flowerLink.energy !== LINK_MAX_TRANSFER_FILL)
			{
				mineLink.transferEnergy(flowerLink);
				continue;
			}

			if(!isNullOrUndefined(upgraderLink) && upgraderLink.energy !== LINK_MAX_TRANSFER_FILL)
			{
				mineLink.transferEnergy(upgraderLink);
				continue;
			}
		}
	}

	removeActor()
	{
		this.core.unsubscribe(EVENTS.EVERY_TICK, this.actorId);
		this.core.unsubscribe(EVENTS.STRUCTURE_BUILD	 + this.memoryObject.roomName, this.actorId);
		this.core.unsubscribe(EVENTS.STRUCTURE_DESTROYED + this.memoryObject.roomName, this.actorId);
		super.removeActor();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
	}
};