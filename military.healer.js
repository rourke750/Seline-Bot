var utils = require('utils');

const normal_creep = [TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,
    TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,
    ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,
    ATTACK,ATTACK,ATTACK,ATTACK,ATTACK];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]
 
var militaryDefender = {
    
    run: function(creep) {
        if (creep.spawning) {
            return;
        } else if (creep.memory.quad) {
            // if we are controlled from a quad then return
            return;
        }

        // we are not a quad lets do our thing
    },
	
	create_creep: function(spawn, quadName=undefined) {
        var newName = 'Healer' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        const b = utilscreep.scaleByEnergy([WORK, CARRY, MOVE], null, spawn.room.energyAvailable);
        spawn.spawnCreep(b, newName,
            {memory: {role: 'healer', 'quad': quadName}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        
    },

    cleanUp(id) {
        
    }
    
}

module.exports = militaryDefender;