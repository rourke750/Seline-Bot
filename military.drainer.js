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
        if (creep.room.name != creep.memory.drainRoom && !creep.memory.healing) {
            // we are trying to drain a room so lets see if we are in the room we want to drain
            // check if our dst room is set
            if (!creep.memory.destLoc)
                creep.memory.destLoc = {roomName: creep.memory.drainRoom};
            utils.move_to(creep);
            return;
        } else if (creep.room.name != creep.memory.drainRoom && creep.memory.dstRoom) {
            // we are healing, just heal ourselves
            creep.heal(creep);
            // todo make sure we are not on exit tile, just move on away
            return;
        }
    },
	
	create_creep: function(spawn, quadName=undefined, dstRoom) {
        var newName = 'Healer' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        const b = utilscreep.scaleByEnergy([TOUGH, TOUGH, HEAL, HEAL, HEAL, MOVE, MOVE, MOVE, MOVE, MOVE], null, spawn.room.energyAvailable);
        spawn.spawnCreep(b, newName,
            {memory: {role: 'healer', 'quad': quadName, drainRoom: dstRoom, healing: false}});
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