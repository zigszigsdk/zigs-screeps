"use strict";

const Service = require('Service');

module.exports = class ServiceRoomCalc extends Service
{
    constructor(core)
    {
        super(core);
    }

    openPosAroundTakeNearestExcept(aroundThisPos, nearestThisPos, exceptThesePos)
    {
        let candidates =
            _.filter(
                this.filterBlockedPositions(
                    this.getRoomPositionsInRange(aroundThisPos.x, aroundThisPos.y, aroundThisPos.roomName, 1)
                ),
                function(rp)
                {
                    for(let index in exceptThesePos)
                        if( exceptThesePos[index][0] === rp.x &&
                            exceptThesePos[index][1] === rp.y &&
                            exceptThesePos[index][2] === rp.roomName)

                            return false;
                    return true;
                }
            );
        return nearestThisPos.findClosestByPath(candidates, {ignoreCreeps: true, ignoreRoads: true});
    }

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
                if(! this.isOnRoomInside(y) || (x === centerX && y === centerY))
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