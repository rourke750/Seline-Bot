var utils = require('utils');
var transport = require('transport');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
const bigger_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]; // 800
const biggerr_creep = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, 
    CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

const rcl_8 = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)],
    [2, bigger_creep, utils.get_creep_cost(bigger_creep)],
    [3, biggerr_creep, utils.get_creep_cost(biggerr_creep)]
]

var roleUpgrader = {

    moveOutOfWayNoEnergy: function(creep) {
        return creep.room.controller;
    },
    
    get_harvest_count: function(room) {
        // todo get the amount of repairs needed and spawn based on it
        if (room.controller && room.controller.my && room.controller.level < 8) {
            let storage = transport.getRoomInfo(room.name, false);
            if (!storage)
                return 1;
            storage = storage.storage;
            const carry = utils.get_creep_carry(build_creeps[room.memory.upgrade_pos_upgrader || 0][1]);
            return Math.max(Math.min(6, storage / carry), 1);
        }
        return 2;
    },
    
    get_main_upgrader: function(creep) {
        return Game.rooms[creep.memory.home_room].controller
    },
    
    run: function(creep) {
        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            utils.cleanup_move_to(creep);
        }
        
	    if(!creep.memory.upgrading) {
            if (!utils.harvest_source(creep, true, this.moveOutOfWayNoEnergy)) {
                creep.memory.upgrading = true;
                utils.cleanup_move_to(creep);
                creep.memory.destId = Game.rooms[creep.memory.home_room].controller.id;
            }
        }
        
        const upgradeErr = creep.upgradeController(Game.rooms[creep.memory.home_room].controller)
        if (creep.memory.upgrading && creep.memory.destId == null) {
            creep.memory.destId = Game.rooms[creep.memory.home_room].controller.id;
        }
        
        if(creep.memory.upgrading && upgradeErr == ERR_NOT_IN_RANGE) {
            utils.move_to(creep, this.get_main_upgrader);
        }
	},
	
	create_creep: function(spawn) {
        var newName = 'Upgrader' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        let b = build_creeps[spawn.room.memory.upgrade_pos_upgrader][1];
        if (spawn.room.controller.level == 8)
            b = rcl_8;
        spawn.spawnCreep(b, newName,
            {memory: {role: 'upgrader', upgrading: false, home_room: spawn.room.name}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
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
        if (energy_available == 0 && build_creeps[room.memory.upgrade_pos_janitor][0] == 0)
            return;
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
    },

    cleanUp(id) {
        
    }
}

module.exports = roleUpgrader;