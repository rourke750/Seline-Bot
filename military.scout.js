var utils = require('utils');

//const normal_creep = [CLAIM, MOVE, MOVE]; // 
const normal_creep = [MOVE, MOVE]; // 300

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]
 
var militaryScout = {
    run: function(creep) {
        // let's check if the current room is owned by us if it is we need to go elseware
        if (creep.spawning) {
            return;
        }
        if (creep.memory.destLoc == null) {
            found = false;
            for (var flag in Game.flags) {
                if (flag.startsWith('Capture')) {
                    // we found a destination
                    creep.memory.destLoc = Game.flags[flag].pos;
                }
            }
            if (!found) {
                // we didn't find a flag now do something clever to see where we want to go
            }
        }
        /*
        if (creep.memory.reserveRoom) {
            const reserveErr = creep.reserveController(creep.room.controller);
            if (reserveErr == ERR_NOT_IN_RANGE) {
                creep.moveByPath(creep.memory.destId);
            }
        } else {
            const sperr = creep.moveByPath(creep.memory.destId);
        }
        */
        
        utils.move_to(creep);
        
    },
	
	create_creep: function(spawn) {
        var newName = 'Scout' + Game.time;
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_scout][1], newName,
            {memory: {role: 'scout'}});
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_scout == null || room.memory.upgrade_pos_scout == undefined) {
            room.memory.upgrade_pos_scout = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_scout][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_scout = build_creeps[build_creeps[room.memory.upgrade_pos_scout][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_scout][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_scout + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_scout = n[0];
            }
        
        }
    }
    
}

module.exports = militaryScout;