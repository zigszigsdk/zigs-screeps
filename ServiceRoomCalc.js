"use strict";

module.exports = class ServiceRoomCalc
{
    constructor(core)
    {
        this.core = core;
    }

    rewindService(){}
    unwindService(){}

    openPosAroundTakeNearest(aroundThisPos, nearestThisPos)
    {
        let candidates = this.filterBlockedPositions(
            this.getRoomPositionsInRange(aroundThisPos.x, aroundThisPos.y, aroundThisPos.roomName, 1));
        return nearestThisPos.findClosestByPath(candidates, {ignoreCreeps: true, ignoreRoads: true});
    }


    getRoomPositionsInRange(centerX, centerY, roomName, range)
    {
        let results = [];

        for(let x = centerX - range; x <= centerX + range; x++)
        {
            if(! this.isOnRoomInside(x))
                continue;

            for(let y = centerY - range; y <= centerY + range; y++)
            {
                if(! this.isOnRoomInside(y))
                    continue;

                results.push(this.core.getRoomPosition([x, y, roomName]));
            }
        }
        return results;
    }

    filterBlockedPositions(positions)
    {
        let result = [];

        positions.forEach((position) =>
        {
            if(position.lookFor(LOOK_TERRAIN)[0] !== "wall")
                result.push(position);
        });

        return result;
    }

    isInRoom(val)
    {
    	return val >= 0 && val <= 49;
    }

    isOnRoomInside(val)
    {
    	return val > 0 && val < 49;
    }

    isOnRoomBoarder(val)
    {
    	return val === 0 || val === 49;
    }

};