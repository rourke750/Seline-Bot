var utils = require('utils');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
const bigger_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 800

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)],
    [2, bigger_creep, utils.get_creep_cost(bigger_creep)]
]

var roleUpgrader = {
    
    get_harvest_count: function(room) {
        // todo get the amount of repairs needed and spawn based on it
        return 2
    },
    
    run: function(creep) {
        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            utils.cleanup_move_to(creep);
        }
        
	    if(!creep.memory.upgrading) {
            if (!utils.harvest_source(creep)) {
                creep.memory.upgrading = true;
                utils.cleanup_move_to(creep);
            }
        }
        
        if(creep.memory.upgrading && creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.memory.destId = creep.room.controller.id;
            utils.move_to(creep);
        }
	},
	
	create_creep: function(spawn) {
        var newName = 'Upgrader' + Game.time;
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_upgrader][1], newName,
            {memory: {role: 'upgrader', upgrading: false}});
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_upgrader == null || room.memory.upgrade_pos_upgrader == undefined) {
            room.memory.upgrade_pos_upgrader = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_upgrader][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_upgrader = build_creeps[build_creeps[room.memory.upgrade_pos_upgrader][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_upgrader][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_upgrader + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_upgrader = n[0];
            }
        
        }
    }
}

module.exports = roleUpgrader;