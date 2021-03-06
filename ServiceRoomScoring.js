"use strict";

let ServiceWithMemory = require('ServiceWithMemory');

const SPOT_SCORE = 5;
const DIST_SCORE = -2;
const DIST_FROM_EDGE_SCORE = 1;

const WALKABLE_TERRAIN_SCORES =
	{ [TERRAIN_SWAMP]: 10
	, [TERRAIN_PLAIN]: 100
	, [TERRAIN_WALL]: Number.NEGATIVE_INFINITY
	, [TERRAIN_OUTSIDE_ROOM]: Number.NEGATIVE_INFINITY
	};

const BUILDING_TERRAIN_SCORES =
	{ [TERRAIN_SWAMP]: 0
	, [TERRAIN_PLAIN]: 0
	, [TERRAIN_WALL]: Number.NEGATIVE_INFINITY
	, [TERRAIN_OUTSIDE_ROOM]: Number.NEGATIVE_INFINITY
	};

const SCORE_WALL_TOUCH = -15;

const NEGATIVE_INFINITY_MEMORY = "NegativeInfinity";
const DIDNT_FIT = "didntFit";

const UPGRADER_UPGRADE_RANGE = 3;

const PATH_IGNORE = {ignoreCreeps: true, ignoreRoads: true};

module.exports = class ServiceRoomScoring extends ServiceWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.terrainCache = locator.getService(SERVICE_NAMES.TERRAIN_CACHE);
		this.roomCalc = locator.getService(SERVICE_NAMES.ROOM_CALC);
	}

	resetService()
	{
		super.resetService();
		this.memoryObject.rooms = {};
	}

	scoreRoom(roomName)
	{

		let room = this.screepsApi.getRoom(roomName);
		let sources = room.find(FIND_SOURCES);

		let locationScores = {};

		let addLocationScore = function(x, y, score)
		{
			if(x < FIRST_OF_ROOM || y < FIRST_OF_ROOM || x > LAST_OF_ROOM || y > LAST_OF_ROOM)
				return;

			if(score === Number.NEGATIVE_INFINITY)
				score = NEGATIVE_INFINITY_MEMORY;

			let at = x + y*100;
			if(typeof locationScores[at] === UNDEFINED)
				locationScores[at] = score;
			else if(locationScores[at] !== NEGATIVE_INFINITY_MEMORY)
					locationScores[at] += score;
		};

		let getlLocationScore = function(x, y)
		{
			if(x < FIRST_OF_ROOM || y < FIRST_OF_ROOM || x > LAST_OF_ROOM || y > LAST_OF_ROOM)
				return Number.NEGATIVE_INFINITY;

			let score = locationScores[x + y*100];

			if(score === NEGATIVE_INFINITY_MEMORY)
				return Number.NEGATIVE_INFINITY;

			if(typeof score === UNDEFINED)
				return 0;

			return score;
		};

		//miningLocations
		let mines = {};
		for(let index in sources)
		{
			let miningPos = this.roomCalc.openPosAroundTakeNearest(sources[index].pos, room.controller.pos);
			let miningSpot = [miningPos.x, miningPos.y, miningPos.roomName];

			let linkPos = this.roomCalc.openPosAroundTakeNearestExcept(miningPos, room.controller.pos, [miningSpot]);
			let linkSpot = [linkPos.x, linkPos.y, linkPos.roomName];

			let parkingPos = this.roomCalc.openPosAroundTakeNearestExcept(miningPos, room.controller.pos, [miningSpot, linkSpot]);
			let parkingSpot = [parkingPos.x, parkingPos.y, parkingPos.roomName];

			mines[sources[index].id] =
				{ sourceId: sources[index].id
				, miningSpot: miningSpot
				, linkSpot: linkSpot
				, parkingSpot: parkingSpot
				};

			_.each(this.roomCalc.getRoomPositionsInRange(miningPos.x, miningPos.y, miningPos.roomName, 1),
				(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));
		}

		let minerals = room.find(FIND_MINERALS);
		let mineral = null;
		if(minerals.length !== 0)
		{
			let miningPos = this.roomCalc.openPosAroundTakeNearest(minerals[0].pos, room.controller.pos);
			let miningSpot = [miningPos.x, miningPos.y, miningPos.roomName];

			let parkingPos = this.roomCalc.openPosAroundTakeNearestExcept(miningPos, room.controller.pos, [miningSpot]);
			let parkingSpot = [parkingPos.x, parkingPos.y, parkingPos.roomName];

			mineral =
				{ miningSpot: miningSpot
				, parkingSpot: parkingSpot
				, id: minerals[0].id
				, mineralType: minerals[0].mineralType
				};

			_.each(this.roomCalc.getRoomPositionsInRange(mineral.miningSpot.x,
													mineral.miningSpot.y,
													mineral.miningSpot.roomName,
													2),
				(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));
		}

		//upgrading location
		let nearestSource = room.controller.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps: true, ignoreRoads: true});

		let candidates =
			this.roomCalc.filterBlockedPositions(
				this.roomCalc.getRoomPositionsInRange(
					room.controller.pos.x,
					room.controller.pos.y,
					roomName,
					4));

		let bestUpgradeScore = Number.NEGATIVE_INFINITY;
		let upgradeContainer;
		let upgraderSpots;

		let miningParkingRoomPostions = [];

		for(let mineId in mines)
			miningParkingRoomPostions.push(this.screepsApi.getRoomPosition(mines[mineId].parkingSpot));

		for(let index in candidates)
		{
			let score =
				candidates[index].findPathTo(nearestSource, PATH_IGNORE).length * DIST_SCORE;

			let openSpots = this.roomCalc.filterBlockedPositions(
				this.roomCalc.getRoomPositionsInRange(candidates[index].x, candidates[index].y, roomName, 1));

			let openSpotScores = [];

			for(let innerIndex in openSpots)
				if(room.controller.pos.getRangeTo(openSpots[innerIndex]) <= UPGRADER_UPGRADE_RANGE)
					openSpotScores.push(
						{	roomPosition: openSpots[innerIndex]
						,	score: 0
						});

			if(openSpotScores.length < 4) //no room for 3 upgraders + 1 loadoff access point.
				continue;

			score += SPOT_SCORE * openSpotScores.length;

			if(score >= bestUpgradeScore)
			{
				upgradeContainer = [candidates[index].x, candidates[index].y, roomName];
				bestUpgradeScore = score;

				for(let spotIndex in openSpotScores)
						for(let mineIndex in miningParkingRoomPostions)
							openSpotScores[spotIndex].score -=
								openSpotScores[spotIndex].roomPosition.
									findPathTo(miningParkingRoomPostions[mineIndex], PATH_IGNORE).length;

				openSpotScores.sort((a, b)=>b.score-a.score); //descending

				//skip the first for transporter access, grab 3 for upgraders.
				upgraderSpots = [];
				for(let index = 1; index <= 3; index++)
				{
					let pos = openSpotScores[index].roomPosition;
					upgraderSpots.push([pos.x, pos.y, pos.roomName]);
				}
			}
		}

		let upgrade =
			{ container: upgradeContainer
			, spots: upgraderSpots
			};

		_.each(this.roomCalc.getRoomPositionsInRange(upgradeContainer[0], upgradeContainer[1], upgradeContainer[2], 1),
			(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));

		//can't build on the edge
		for(let x = FIRST_OF_ROOM; x <= LAST_OF_ROOM; x += LAST_OF_ROOM - FIRST_OF_ROOM)
			for(let y = FIRST_OF_ROOM; y <= LAST_OF_ROOM; y += LAST_OF_ROOM - FIRST_OF_ROOM)
				addLocationScore(x, y, Number.NEGATIVE_INFINITY);

		//better score further from room edges
		for(let x = FIRST_INSIDE_ROOM; x <= LAST_INSIDE_ROOM; x++)
			for(let y = FIRST_INSIDE_ROOM; y <= LAST_INSIDE_ROOM; y++)
				addLocationScore(x, y, Math.min(x - FIRST_OF_ROOM,
												y - FIRST_OF_ROOM,
												LAST_OF_ROOM - x,
												LAST_OF_ROOM - y) * DIST_FROM_EDGE_SCORE);

		let roomCalc = this.roomCalc;
		let terrainCache = this.terrainCache;

		let getTerrainScore = function(pos, buildingType)
		{
			let wallScore = 0;
			_.each(roomCalc.getRoomPositionsInRange(pos[0], pos[1], pos[2], 1),
				(rp) => {
					if(terrainCache.getAt(rp.x, rp.y, rp.roomName) === TERRAIN_WALL)
						wallScore += SCORE_WALL_TOUCH;
				}
			);
			if(buildingType === STRUCTURE_ROAD || buildingType === STRUCTURE_CONTAINER)
				return wallScore + WALKABLE_TERRAIN_SCORES[terrainCache.getAt(pos.x, pos.y, roomName)];
			else
				return wallScore + BUILDING_TERRAIN_SCORES[terrainCache.getAt(pos.x, pos.y, roomName)];
		};

		let fitAndScorePattern = function(pattern)
		{
			let relativePositions = [];
			let buildingKeys = Object.keys(pattern.buildings);
			for(let buildingKeyIndex = buildingKeys.length-1; buildingKeyIndex >= 0; buildingKeyIndex--)
			{
				let key = buildingKeys[buildingKeyIndex];
				for(let posIndex = 0; posIndex < pattern.buildings[key].pos.length; posIndex++)
				{
					let pos = pattern.buildings[key].pos[posIndex];
					relativePositions.push(
						{ x: pos.x
						, y: pos.y
						, type: key
					});
				}
			}

			let bestScore = Number.NEGATIVE_INFINITY;
			let bestPos = DIDNT_FIT;

			for(let x = FIRST_INSIDE_ROOM; x <= LAST_INSIDE_ROOM; x++)
				for(let y = FIRST_INSIDE_ROOM; y <= LAST_INSIDE_ROOM; y++)
				{
					let score = 0;

					for(let posIndex = relativePositions.length-1;
						posIndex >= 0;
						posIndex--)
					{
						let relativePosition = relativePositions[posIndex];
						let pos = 	{ x: x + relativePosition.x
									, y: y + relativePosition.y
									};

						let terrainScore = getTerrainScore(pos, relativePosition.type);
						let locationScore = getlLocationScore(pos.x, pos.y);

						score += terrainScore + locationScore;
						if(score === Number.NEGATIVE_INFINITY)
							break;
					}

					if(score > bestScore)
					{
						bestPos = [x, y];
						bestScore = score;
					}
				}


			if(bestPos === DIDNT_FIT)
				return 	{ score: Number.NEGATIVE_INFINITY
						, pattern: DIDNT_FIT
						};

			let absolutePattern = {};
			for(let buildingKeyIndex = buildingKeys.length-1; buildingKeyIndex >= 0; buildingKeyIndex--)
			{
				let key = buildingKeys[buildingKeyIndex];
				absolutePattern[key] = [];

				for(let posIndex = pattern.buildings[key].pos.length-1; posIndex >= 0; posIndex--)
				{
					let relativePosition = pattern.buildings[key].pos[posIndex];
					let pos = 	[ relativePosition.x + bestPos[0]
								, relativePosition.y + bestPos[1]
								, roomName
								];

					absolutePattern[key].push(pos);

					_.each(roomCalc.getRoomPositionsInRange(pos[0], pos[1], pos[2], 1),
						(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));
				}
			}

			return 	{ score: bestScore
					, pattern: absolutePattern
					};

		};

		let flower = fitAndScorePattern(FLOWER_PATTERN);
		let storage = fitAndScorePattern(STORAGE_PATTERN);

		if(flower.score === Number.NEGATIVE_INFINITY)
		{
			this.memoryObject.rooms[roomName] =
				{ roomScore: "unsuited"
				};
			return;
		}

		this.memoryObject.rooms[roomName] =
			{ roomScore: flower.score + storage.score
			, mines: mines
			, upgrade: upgrade
			, mineral: mineral
			, flower: flower.pattern
			, storage: storage.score === Number.NEGATIVE_INFINITY ? null : storage.pattern
			};

		return this.memoryObject.rooms[roomName];
	}

	getRoom(roomName)
	{
		if(typeof this.memoryObject.rooms[roomName] === UNDEFINED)
			throw new Error("tried to get result of unscored room: " + roomName);

		return this.memoryObject.rooms[roomName];
	}

};