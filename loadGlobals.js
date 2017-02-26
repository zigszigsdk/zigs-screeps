"use strict";

module.exports = function()
{
	global.SERVICE_NAMES =
		{ ROOM_CALC: "ServiceRoomCalc"
		, MAP_CALC: "ServiceMapCalc"
		, TERRAIN_CACHE: "ServiceTerrainCache"
		, ROOM_SCORING: "ServiceRoomScoring"
		, MAP_STATUS: "ServiceMapStatus"
		, MAP_NAVIGATION: "ServiceMapNavigation"
		, MAP_SEARCH: "ServiceMapSearch"
		};

	global.ACTOR_NAMES =
		{ ROOM_GUARD: "ActorRoomGuard"
		, ROOM_MINE_ENERGY: "ActorRoomMineEnergy"
		, ROOM_MINE_MINERAL: "ActorRoomMineMineral"
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
		, ROOM_EXPLORE: "ActorRoomExplore"
		, ROOM_STORAGE_KEEPER: "ActorRoomStorageKeeper"
		, STRUCTURE_EVENTS: "ActorStructureEvents"
		, TICK_EXPANDER: "ActorTickExpander"
		};

	global.CLASS_NAMES =
		{ CREEP_BODY_FACTORY: "CreepBodyFactory"
		, RESOURCE_REQUEST: "ResourceRequest"
		};

	global.EVENTS =
		{ EVERY_TICK_EARLY: "everyTickEarly"
		, EVERY_TICK: "everyTick"
		, EVERY_TICK_LATE: "everyTickLate"
		, ROOM_LEVEL_CHANGED: "roomLevelChanged"
		, STRUCTURE_DESTROYED: "structureDestroyed"
		, STRUCTURE_BUILD: "structureBuild"
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

	global.isUndefined = (x) => typeof x === UNDEFINED;
	global.isNull = (x) => x === null;
	global.isUndefinedOrNull = (x) => x === null || typeof x === UNDEFINED;
	global.isNullOrUndefined = (x) => x === null || typeof x === UNDEFINED;
	global.isString = (x) => typeof x === STRING;
	global.isBoolean = (x) => typeof x === BOOLEAN;
	global.isNumber = (x) => typeof x === NUMBER;
	global.isSymbol = (x) => typeof x === SYMBOL;
	global.isFunction = (x) => typeof x === FUNCTION;
	global.isObject = (x) => x !== null && typeof x === OBJECT && typeof x.length === UNDEFINED;
	global.isObjectOrArray = (x) => x !== null && typeof x === OBJECT;
	global.isArray = (x) => x !== null && typeof x === OBJECT && typeof x.length !== UNDEFINED;

	global.FIRST_OF_ROOM = 0;
	global.FIRST_INSIDE_ROOM = 1;
	global.LAST_INSIDE_ROOM = 48;
	global.LAST_OF_ROOM = 49;

	global.FILTERS =
		{ CONTAINERS: {filter: (x)=>x.structureType === STRUCTURE_CONTAINER}
		, EXTENSIONS: {filter: (x)=>x.structureType === STRUCTURE_EXTENSION}
		, TOWERS: {filter: (x)=>x.structureType === STRUCTURE_TOWER}
		, SPAWNS: {filter: (x)=>x.structureType === STRUCTURE_SPAWN}
		, ANY_STORAGE: { filter: function(x)
		{
			switch(x.structureType)
			{
				case STRUCTURE_SPAWN:
				case STRUCTURE_EXTENSION:
				case STRUCTURE_LINK:
				case STRUCTURE_STORAGE:
				case STRUCTURE_TOWER:
				case STRUCTURE_POWER_SPAWN:
				case STRUCTURE_LAB:
				case STRUCTURE_TERMINAL:
				case STRUCTURE_CONTAINER:
				case STRUCTURE_NUKER:
					return true;
				default:
					return false;}}}
		};
	global.LEVEL_INDEX =
		//  room level           0,   1,   2,   3,   4,   5,   6,   7,   8
		{ MAX_EXTENSIONS:     [  0,   0,   5,  10,  20,  30,  40,  50,  60]
		, EXTENSION_CAPACITY: [  0,   0,  50,  50,  50,  50,  50, 100, 200]
		, MAX_TOWERS:         [  0,   0,   0,   1,   1,   2,   2,   3,   6]
		};

	global.LEVEL_REQUIRED_TO_MINE_MINERALS = 6;

	global.PRIORITY_NAMES =
	{	SPAWN:
			{ ADHOC: "SPAWN_ADHOC"
			, RECOVERY_FILLER: "SPAWN_RECOVERY_FILLER"
			, RECOVERY_MINER: "SPAWN_RECOVERY_MINER"
			, FILLER: "SPAWN_FILLER"
			, ENERGY_MINER: "SPAWN_ENERGY_MINER"
			, MINERAL_MINER: "SPAWN_MINERAL_MINER"
			, HAULER: "SPAWN_HAULER"
			, UPGRADER: "SPAWN_UPGRADER"
			, BUILDER: "SPAWN_BUILDER"
			, FIXER: "SPAWN_FIXER"
			, OFFENSE: "SPAWN_OFFENSE"
			, EXPLORER: "SPAWN_EXPLORER"
			, STORAGE_KEEPER: "SPAWN_STORAGE_KEEPER"
			}
		, BUILD:
			{ ADHOC: "BUILD_ADHOC"
			, EXTENSION_FIRST_FIVE: "BUILD_EXTENSION_FIRST_FIVE"
			, EXTENSION_AFTER_FIVE: "BUILD_EXTENSION_AFTER_FIVE"
			, SPAWN: "BUILD_SPAWN"
			, ENERGY_MINING_CONTAINER: "BUILD_ENERGY_MINING_CONTAINER"
			, MINERAL_MINING_CONTAINER: "BUILD_MINERAL_MINING_CONTAINER"
			, UPGRADER_CONTAINER: "BUILD_UPGRADER_CONTAINER"
			, TOWER: "BUILD_TOWER"
			, FLOWER_LINK: "BUILD_FLOWER_LINK"
			, FLOWER_ROAD: "BUILD_FLOWER_ROAD"
			, FLOWER_CONTAINER: "BUILD_FLOWER_CONTAINER"
			, MINERAL_EXTRACTOR: "BUILD_MINERAL_EXTRACTOR"
			, STORAGE_LINK: "BUILD_STORAGE_LINK"
			, POWER_SPAWN: "BUILD_POWER_SPAWN"
			, STORAGE: "BUILD_STORAGE"
			, NUKER: "BUILD_NUKER"
			, TERMINAL: "BUILD_TERMINAL"
			, LAB: "BUILD_LAB"
			, STORAGE_ROAD: "BUILD_STORAGE_ROAD"
			, UPGRADER_LINK: "BUILD_UPGRADER_LINK"
			, ENERGY_MINING_LINK: "BUILD_ENERGY_MINING_LINK"
			}
		, RESOURCE:
			{ ADHOC: "RESOURCE_ADHOC"
			, FILLER: "RESOURCE_FILLER"
			, DEFAULT: "RESOURCE_DEFAULT"
			, UPGRADE: "RESOURCE_UPGRADE"
			, STORAGE: "RESOURCE_STORAGE"
			, MINERAL: "RESOURCE_MINERAL"
			}
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
	    , MOVE_TO_ROOM: "moveToRoom"
	    , WAIT_UNTIL_DEATH: "waitUntilDeath"
	    , GOTO_IF_TTL_LESS: "gotoIfTtlLess"
	    , PICKUP_AT_NEAREST: "pickupAtNearest"
	    };
};
