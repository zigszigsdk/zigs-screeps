"use strict";

module.exports = function()
{
	global.SERVICE_NAMES =
		{ ROOM_CALC: "ServiceRoomCalc"
		, MAP_CALC: "ServiceMapCalc"
		, TERRAIN_CACHE: "ServiceTerrainCache"
		, ROOM_SCORING: "ServiceRoomScoring"
		};

	global.ACTOR_NAMES =
		{ ROOM_GUARD: "ActorRoomGuard"
		, ROOM_MINE: "ActorRoomMine"
		, ROOM_BUILD: "ActorRoomBuild"
		, ROOM_REPAIR: "ActorRoomRepair"
		, ROOM_UPGRADE: "ActorRoomUpgrade"
		, ROOM_OFFENSE: "ActorRoomOffense"
		, ROOM_HAUL: "ActorRoomHaul"
		, ROOM_FILL: "ActorRoomFill"
		, PROCEDUAL_CREEP: "ActorProceduralCreep"
		, CONTROLLED_ROOM: "ActorControlledRoom"
		, ROOM_SCORING: "ActorRoomScoring"
		, ROOM_BOOTER: "ActorRoomBooter"
		};

	global.CLASS_NAMES =
		{ CREEP_BODY_FACTORY: "CreepBodyFactory"
		};

	global.EVENTS =
		{ EVERY_TICK_EARLY: "everyTickEarly"
		, EVERY_TICK: "everyTick"
		, EVERY_TICK_LATE: "everyTickLate"
		};

	global.NORTH = "N";
	global.SOUTH = "S";
	global.EAST = "E";
	global.WEST = "W";

	global.TERRAIN_WALL = "wall";
	global.TERRAIN_PLAIN = "plain";
	global.TERRAIN_SWAMP = "swamp";
	global.TERRAIN_OUTSIDE_ROOM = "terrainOutsideRoom";

	global.FUNCTION = 'function';
	global.STRING = 'string';
	global.NUMBER = 'number';
	global.OBJECT = 'object';
	global.UNDEFINED = 'undefined';
	global.BOOLEAN = 'boolean';
	global.SYMBOL = 'symbol';

	global.FIRST_OF_ROOM = 0;
	global.FIRST_INSIDE_ROOM = 1;
	global.LAST_INSIDE_ROOM = 48;
	global.LAST_OF_ROOM = 49;

	global.FILTERS =
		{ CONTAINERS: {filter: (x)=>x.structureType === STRUCTURE_CONTAINER}
		, EXTENSIONS: {filter: (x)=>x.structureType === STRUCTURE_EXTENSION}
		, TOWERS: {filter: (x)=>x.structureType === STRUCTURE_TOWER}
		, SPAWNS: {filter: (x)=>x.structureType === STRUCTURE_SPAWN}
		};

	global.LEVEL_INDEX =
		//  room level           0,   1,   2,   3,   4,   5,   6,   7,   8
		{ MAX_EXTENSIONS:     [  0,   0,   5,  10,  20,  30,  40,  50,  60]
		, EXTENSION_CAPACITY: [  0,   0,  50,  50,  50,  50,  50, 100, 200]
		, MAX_TOWERS:         [  0,   0,   0,   1,   1,   2,   2,   3,   6]
		};

	global.CREEP_INSTRUCTION =
	    { SPAWN_UNTIL_SUCCESS: "spawnUntilSucess"
	    , CALLBACK: "callback"
	    , MINE_UNTIL_FULL: "mineUntilFull"
	    , UPGRADE_UNTIL_EMPTY: "upgradeUntilEmpty"
	    , GOTO_IF_ALIVE: "gotoIfAlive"
	    , DESTROY_SCRIPT: "destroyScript"
	    , PICKUP_AT_POS: "pickupAtPos"
	    , BUILD_UNTIL_EMPTY: "buildUntilEmpty"
	    , GOTO_IF_STRUCTURE_AT: "gotoIfStructureAt"
	    , RECYCLE_CREEP: "recycleCreep"
	    , MOVE_TO_POSITION: "moveToPosition"
	    , MINE_UNTIL_DEATH: "mineUntilDeath"
	    , FILL_NEAREST_UNTIL_EMPTY: "fillNearestUntilEmpty"
	    , DEPOSIT_AT: "depositAt"
	    , DISMANTLE_AT: "dismantleAt"
	    , FIX_AT: "fixAt"
	    , GOTO_IF_NOT_FIXED: "gotoIfNotFixed"
	    , REMOVE_FLAG_AT: "removeFlagAt"
	    , GOTO_IF_DEAD: "gotoIfDead"
	    , GOTO: "goto"
	    , CLAIM_AT: "claimAt"
	    };
};
