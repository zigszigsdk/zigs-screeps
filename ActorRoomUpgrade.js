"use strict";

let ActorWithMemory = require('ActorWithMemory');

const MAX_CREEPS_OVER_LEVEL = [0, 1, 3, 3, 3, 3, 3, 3, 3];
const TARGET_RESOURCE_RESERVE = 1500;

const UPGRADER_PARKING_PREFIX = "UpgraderParkingPermission:";

module.exports = class ActorRoomUpgrade extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = locator.getClass(CLASS_NAMES.RESOURCE_REQUEST);

		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
		this.roomNavigation = locator.getService(SERVICE_NAMES.ROOM_NAVIGATION);
	}

	initiateActor(parentId, roomName)
	{
		let score = this.roomScoring.getRoom(roomName);
		let parkingSpots = score.upgrade.spots;

		for(let index in parkingSpots)
		{
			const ps = parkingSpots[index];
			this.roomNavigation.reservePositions(	roomName,
													{x: ps[0], y: ps[1], roomName: ps[2]},
													UPGRADER_PARKING_PREFIX + index);
		}

		this.memoryObject =
			{ roomName: roomName
			, parentId: parentId
			, creepCount: 0
			, energyPos: score.upgrade.container
			, parking:
				{ spots: parkingSpots
				, actors: Array(parkingSpots.length)
				}
			, controllerId: this.screepsApi.getRoom(roomName).controller.id
			};
	}

	lateInitiate()
	{

		let parent = this.actors.get(this.memoryObject.parentId);


		parent.requestBuilding(	[STRUCTURE_CONTAINER, STRUCTURE_LINK],
								this.memoryObject.energyPos,
								PRIORITY_NAMES.BUILD.UPGRADER_CONTAINER,
								2);

		let request = new this.ResourceRequest(this.memoryObject.energyPos, RESOURCE_ENERGY)
					.setPriorityName(PRIORITY_NAMES.RESOURCE.UPGRADE)
					.setRate(-15)
					.setDesired(TARGET_RESOURCE_RESERVE)
					.setMin(250)
					.fabricate();

		parent.requestResource(request);

		this.requestCreep();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		let oldActors = [];
		for(let index in oldMemory.parking.actor)
			if(!isNullOrUndefined(oldMemory.parking.actor[index]))
				oldActors.push(oldMemory.parking.actor[index]);

		for(let index = 0; index < this.memoryObject.parking.spots.length && oldActors.length > 0; index++)
			this.memoryObject.parking.actors[index] = oldActors.pop();

		for(let index in oldActors)
			this.actors.get(oldActors[index]).setPointer(5); //destroy self and report to this script

		//these two will be adjusted automatically by the actors calling back on death.
		this.memoryObject.creepCount = oldMemory.creepCount;

		this.lateInitiate();
	}

	requestCreep()
	{
		const room = this.screepsApi.getRoom(this.memoryObject.roomName);
		const maxCreeps = MAX_CREEPS_OVER_LEVEL[room.controller.level];
		if(this.memoryObject.creepCount >= maxCreeps)
			return;

		const parent = this.actors.get(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createUpgrader"
			, priority: PRIORITY_NAMES.SPAWN.UPGRADER
			, energyNeeded: 2000
			});
	}

	createUpgrader(spawnId)
	{
		let parkingIndex = -1;
		for(let index = 0; index < this.memoryObject.parking.actors.length; index++)
			if(isNullOrUndefined(this.memoryObject.parking.actors[index]))
			{
				parkingIndex = index;
				break;
			}

		if(parkingIndex === -1) //no free spaces. Limited by room layout / roomscoring
			return;

		const callbackTo = 	{ actorId: this.actorId
							, diedFunctionName: "upgraderDied"
							};

		const ps = this.memoryObject.parking.spots[parkingIndex];
		const el = this.memoryObject.energyPos;
		const positions = 	{ parkingSpace: {x:ps[0], y:ps[1], roomName:ps[2]}
							, energyLocation: {x:el[0], y:el[1], roomName:el[2]}
							};

		const actorResult = this.actors.create(ACTOR_NAMES.CREEP_UPGRADER,
			(script)=>script.initiateActor(callbackTo,
											positions,
											spawnId,
											parkingIndex,
											[UPGRADER_PARKING_PREFIX + parkingIndex]
											));

		this.memoryObject.creepCount++;
		this.memoryObject.parking.actors[parkingIndex] = actorResult.id;

		this.requestCreep();
	}

	upgraderDied(parkingIndex)
	{
		this.memoryObject.creepCount--;
		this.memoryObject.parking.actors[parkingIndex] = null;

		this.requestCreep();
	}
};