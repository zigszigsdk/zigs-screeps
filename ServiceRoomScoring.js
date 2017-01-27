"use strict";

let ServiceWithMemory = require('ServiceWithMemory');

const SPOT_SCORE = 5;
const DIST_SCORE = -2;
const DIST_FROM_EDGE_SCORE = 1;

const TERRAIN_SCORES =
	{ [TERRAIN_SWAMP]: 10
	, [TERRAIN_PLAIN]: 100
	, [TERRAIN_WALL]: Number.NEGATIVE_INFINITY
	, [TERRAIN_OUTSIDE_ROOM]: Number.NEGATIVE_INFINITY
	};

const NEGATIVE_INFINITY_MEMORY = "NegativeInfinity";
const FLOWER_DIDNT_FIT = "flowerDidntFit";

module.exports = class ServiceRoomScoring extends ServiceWithMemory
{
	constructor(core)
	{
		super(core);
	}

	rewindService()
	{
		super.rewindService();

		if(typeof this.memoryObject.rooms === UNDEFINED)
			this.memoryObject.rooms = {};
	}

	scoreRoom(roomName)
	{
		let terrainCache = this.core.getService(SERVICE_NAMES.TERRAIN_CACHE);
		let roomCalc = this.core.getService(SERVICE_NAMES.ROOM_CALC);

		let room = this.core.getRoom(roomName);
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
        	let miningPos = roomCalc.openPosAroundTakeNearest(sources[index].pos, room.controller.pos);

        	mines[sources[index].id] =
        		{ sourceId: sources[index].id
        		, miningSpot: [miningPos.x, miningPos.y, miningPos.roomName]
        		};

    		_.each(roomCalc.getRoomPositionsInRange(miningPos.x, miningPos.y, miningPos.roomName, 1),
        		(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));
        }

        //upgrading location
        let nearestSource = room.controller.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps: true, ignoreRoads: true});

		let candidates =
			roomCalc.filterBlockedPositions(
				roomCalc.getRoomPositionsInRange(
					room.controller.pos.x,
					room.controller.pos.y,
					roomName,
					4));

		let bestUpgradeScore = Number.NEGATIVE_INFINITY;
		let upgradeContainer;
		for(let index in candidates)
		{
			let score =
				candidates[index].findPathTo(nearestSource, {ignoreCreeps: true, ignoreRoads: true}).length * DIST_SCORE;

			let openSpots = roomCalc.filterBlockedPositions(
				roomCalc.getRoomPositionsInRange(candidates[index].x, candidates[index].y, roomName, 1));

			for(let innerIndex in openSpots)
				if(room.controller.pos.getRangeTo(openSpots[innerIndex]) <= 3)
					score += SPOT_SCORE;

			if(score >= bestUpgradeScore)
			{
				upgradeContainer = [candidates[index].x, candidates[index].y, roomName];
				bestUpgradeScore = score;
			}
		}

    	_.each(roomCalc.getRoomPositionsInRange(upgradeContainer[0], upgradeContainer[1], upgradeContainer[2], 1),
			(rp) => addLocationScore(rp.x, rp.y, Number.NEGATIVE_INFINITY));

		//flower scoring
		let flowerRelativePositions = [];
		let buildingKeys = Object.keys(FLOWER_PATTERN.buildings);
		for(let buildingKeyIndex = buildingKeys.length-1; buildingKeyIndex >= 0; buildingKeyIndex--)
		{
			let key = buildingKeys[buildingKeyIndex];
			for(let posIndex = FLOWER_PATTERN.buildings[key].pos.length-1; posIndex >= 0; posIndex--)
			{
				let pos = FLOWER_PATTERN.buildings[key].pos[posIndex];
				flowerRelativePositions.push([pos.x, pos.y]);
			}
		}

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

		let bestFlowerScore = Number.NEGATIVE_INFINITY;
		let flowerPos = FLOWER_DIDNT_FIT;

		for(let x = FIRST_INSIDE_ROOM; x <= LAST_INSIDE_ROOM; x++)
			for(let y = FIRST_INSIDE_ROOM; y <= LAST_INSIDE_ROOM; y++)
			{
				let score = 0;

				for(let flowerPosIndex = flowerRelativePositions.length-1;
					flowerPosIndex >= 0;
					flowerPosIndex--)
				{
					let relative = flowerRelativePositions[flowerPosIndex];
					let pos = 	{ x: x + relative[0]
								, y: y + relative[1]
								};

					let terrainScore = TERRAIN_SCORES[terrainCache.getAt(pos.x, pos.y, roomName)];
					let locationScore = getlLocationScore(pos.x, pos.y);

					score += terrainScore + locationScore;
					if(score === Number.NEGATIVE_INFINITY)
						break;
				}

				if(score > bestFlowerScore)
				{
					flowerPos = [x, y];
					bestFlowerScore = score;
				}
			}

		//finalizing results
		let scoring;
		if(flowerPos === FLOWER_DIDNT_FIT)
		{
			scoring = 	{ roomScore: "unsuited"
						};
		}
		else
		{
			scoring =	{ roomScore: bestFlowerScore
						, mines: mines
						, upgradeContainer: upgradeContainer
						, flower: {}
						};

			for(let buildingKeyIndex = buildingKeys.length-1; buildingKeyIndex >= 0; buildingKeyIndex--)
			{
				let key = buildingKeys[buildingKeyIndex];
				scoring.flower[key] = [];

				for(let posIndex = FLOWER_PATTERN.buildings[key].pos.length-1; posIndex >= 0; posIndex--)
				{
					let pos = FLOWER_PATTERN.buildings[key].pos[posIndex];
					scoring.flower[key].push(
						[ pos.x + flowerPos[0]
						, pos.y + flowerPos[1]
						]);
				}
			}
		}

		this.memoryObject.rooms[roomName] = scoring;
	}

	getRoom(roomName)
	{
		if(typeof this.memoryObject.rooms[roomName] === UNDEFINED)
			throw {msg: "tried to get result of unscored room: " + roomName};

		return this.memoryObject.rooms[roomName];
	}
};