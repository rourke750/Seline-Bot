var utils = require('utils');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE];
const bigger_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 800

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)],
    [2, bigger_creep, utils.get_creep_cost(bigger_creep)]
]
var roleHarvester = {
    
    get_harvest_count: function(room) {
        
    },
    
    run: function(creep) {
        if (creep.memory.collecting) {
            if (!utils.harvest_source(creep)) {
                creep.memory.collecting = false;
                utils.cleanup_move_to(creep);
            }
        }
        else {
            if (creep.memory.destId == null) {
                var targets = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && structure.room.name == creep.room.name;
                        }
                    });
                if(targets != null) {
                    creep.memory.destId = targets.id;
                } else {
                    // all energy is full let's just move ten above the spawner
                    
                    var targets = creep.room.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                                    structure.room.name == creep.room.name;
                            }
                    });
                    creep.memory.destId = targets[Math.floor(Math.random() * targets.length)].id;
                    //console.log('moving to random energy structure ' + creep.id + ' ' );
                }
            }
            const dst = Game.getObjectById(creep.memory.destId);
            if (creep.store.getUsedCapacity() == 0) {
                creep.memory.collecting = true;
                utils.cleanup_move_to(creep);
            }
            else {
                const tErr = creep.transfer(dst, RESOURCE_ENERGY);
                if (tErr == ERR_NOT_IN_RANGE) {
                    utils.move_to(creep);
                } else if (tErr == ERR_FULL) {
                    utils.cleanup_move_to(creep);
                    // todo sleep for x amount of time
                }
            }
        }
	},
	
	create_creep: function(spawn) {
        var newName = 'Harvester' + Game.time;
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_harvester][1], newName,
            {memory: {role: 'harvester', collecting: false}});
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_harvester == null || room.memory.upgrade_pos_harvester == undefined) {
            room.memory.upgrade_pos_harvester = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_harvester][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_harvester = build_creeps[build_creeps[room.memory.upgrade_pos_harvester][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_harvester][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_harvester + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_harvester = n[0];
            }
        
        }
    }
};

module.exports = roleHarvester;