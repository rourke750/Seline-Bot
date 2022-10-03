var utils = require('utils');
const utilscreep = require('utilscreep');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE];
const bigger_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 800
const bigger_creepv2 = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, 
    CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] // 800

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)],
    [2, bigger_creep, utils.get_creep_cost(bigger_creep)],
    [3, bigger_creepv2, utils.get_creep_cost(bigger_creepv2)]
]
var roleHarvester = {
    
    get_harvest_count: function(room) {
        
    },
    
    find_all_storage_structures: function(creep) { 
        return creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                        structure.room.name == creep.room.name;
                }
        });
    },
    
    run: function(creep) {
        // check if we are out of energy if we are time to switch to collection mode
        if (!creep.memory.collecting && creep.store.getUsedCapacity() == 0) {
            creep.memory.collecting = true;
            utils.cleanup_move_to(creep);
        }

        if (creep.memory.collecting) {
            if (!utils.harvest_source(creep)) {
                creep.memory.collecting = false;
                utils.cleanup_move_to(creep);
            }
        }
        else { // todo get rid of this else statement
            // start of destination code
            if (creep.memory.destId == null && creep.memory.destLoc == null) {
                // this if statement is called immediatly a collection has just ended and we want to drop off the resources
                // first lets check if the destination room is the same room
                if (creep.memory.home_room != creep.pos.roomName) {
                    // we are in a neighboring room need to return
                    // we do not care about the location as long as we go back to the original room
                    creep.memory.destLoc = {roomName: creep.memory.home_room};
                } else {
                    // we are in the same room we can just find the location now
                    var targets = utilscreep.find_closest_drop_off_structure(creep);
                    if (targets != null) {
                        creep.memory.destId = targets.id;
                        creep.memory.destLoc = targets.pos;
                        //console.log(targets)
                    } else {
                        // all energy is full let's just move ten above the spawner
                        var targets = this.find_all_storage_structures(creep);
                        const i = Math.floor(Math.random() * targets.length);
                        creep.memory.destId = targets[i].id;
                        creep.memory.destLoc = targets[i].pos;
                    }
                }
            }
            // end destination code
            
            
            // we know we are in the same room and can try transfering
            const dst = Game.getObjectById(creep.memory.destId);
            if (dst == null) {
                utils.move_to(creep, utilscreep.find_closest_drop_off_structure);
            } else {
                const tErr = creep.transfer(dst, RESOURCE_ENERGY);
                
                if (tErr == ERR_NOT_IN_RANGE) {
                    utils.move_to(creep, utilscreep.find_closest_drop_off_structure);
                } else if (tErr == ERR_FULL) {
                    utils.cleanup_move_to(creep);
                    // todo sleep for x amount of time
                }
            }
        }
	},
	
	create_creep: function(spawn) {
        var newName = 'Harvester' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_harvester][1], newName,
            {memory: {role: 'harvester', collecting: true, home_room: spawn.room.name}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
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
        if (energy_available == 0 && build_creeps[room.memory.upgrade_pos_janitor][0] == 0)
            return;
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_harvester][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_harvester = build_creeps[build_creeps[room.memory.upgrade_pos_harvester][0] - 1][0];
        } else if (room.energyAvailable <= current_upgrade_cost && build_creeps[room.memory.upgrade_pos_harvester][0] > 0 &&
            _.filter(utilscreep.get_filtered_creeps('harvester'), (creep) => creep.memory.home_room == room.name).length < 3) {
            // todo this might be bouncing back and forth investigate
            // we don't have any more harvesters let's try downgrade build some up and re up
            room.memory.upgrade_pos_harvester = build_creeps[build_creeps[room.memory.upgrade_pos_harvester][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_harvester][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_harvester + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_harvester = n[0];
            }
        
        }
    },

    cleanUp(id) {
        
    }
};

module.exports = roleHarvester;