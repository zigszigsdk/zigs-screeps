"use strict";

module.exports = function()
{
	global.DEBUG = false;
	global.CPU_SAFETY_RATIO = 0.25;

	global.FUNCTION = 'function';
	global.STRING = 'string';
	global.NUMBER = 'number';
	global.OBJECT = 'object';
	global.UNDEFINED = 'undefined';
	global.BOOLEAN = 'boolean';
	global.SYMBOL = 'symbol';

	global.FILTERS =
		{ CONTAINERS: {filter: (x)=>x.structureType === STRUCTURE_CONTAINER}
		, EXTENSIONS: {filter: (x)=>x.structureType === STRUCTURE_EXTENSION}
		, TOWERS: {filter: (x)=>x.structureType === STRUCTURE_TOWER}
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
