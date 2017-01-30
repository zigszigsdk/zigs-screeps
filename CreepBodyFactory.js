"use strict";

const MAX_BODYPARTS = 50;

module.exports = class CreepBodyFactory
{
	constructor()
	{
		this.data =
			{ maxCost: 0
			, patterns: []
			, replaces: []
			, sortOrder: []
		};
	}

	addPattern(patternList, maxTimes)
	{
		this.data.patterns.push(	{ pattern: patternList
									, maxTimes: maxTimes });
		return this;
	}

	addReplace(oldPart, newPart, maxTimes)
	{
		this.data.replaces.push( 	{ oldPart: oldPart
									, newPart: newPart
									, maxTimes: maxTimes });
		return this;
	}

	setSort(order)
	{
		this.data.sortOrder = order;

		return this;
	}

	setMaxCost(maxCost)
	{
		this.data.maxCost = maxCost;

		return this;
	}

	export()
	{
		return this.data;
	}

	import(data)
	{
		this.data = data;

		return this;
	}

	fabricate()
	{
		let bodypartPrice = ((part) =>
        {
            switch(part)
            {
                case MOVE:          return  50;
                case CARRY:         return  50;
                case WORK:          return 100;
                case ATTACK:        return  80;
                case RANGED_ATTACK: return 150;
                case HEAL:          return 250;
                case CLAIM:         return 600;
                case TOUGH:         return  10;
                default: 			return Number.MAX_SAFE_INTEGER;}});

		let maxCost = this.data.maxCost;
		let currentCost = 0;
		let result = [];
		let endPatterns = false;

		this.data.patterns.forEach(function(patternObject)
		{
			if(endPatterns)
				return;

			for(let repeats = 0; repeats < patternObject.maxTimes; repeats++)
			{
				let addition = [];
				let additionCost = 0;

				for(let index in patternObject.pattern)
				{
					let part = patternObject.pattern[index];
					let price = bodypartPrice(part);
					if(price + additionCost + currentCost > maxCost || result.length + addition.length >= MAX_BODYPARTS)
					{
						endPatterns = true;
						return;
					}

					additionCost += price;
					addition.push(part);
				}

				currentCost += additionCost;
				for(let index in addition)
					result.push(addition[index]);
			}
		});

		this.data.replaces.forEach(function(replaceObject)
		{
			for(let repeats = 0; repeats < replaceObject.maxTimes; repeats++)
			{
				let index = result.indexOf(replaceObject.oldPart);
				if(index === -1)
					break;

				let oldCost = bodypartPrice(replaceObject.oldPart);
				let newCost = bodypartPrice(replaceObject.newPart);

				if(currentCost - oldCost + newCost > maxCost)
					break;

				currentCost += newCost - oldCost;
				result[index] = replaceObject.newPart;
			}
		} );

		if(this.data.sortOrder.length !== 0)
			result = _.sortBy(result, (part)=> this.data.sortOrder.indexOf(part));

		return result;
	}
};