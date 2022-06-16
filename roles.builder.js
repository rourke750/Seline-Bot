var utils = require('utils');

const normal_creep = [WORK, CARRY, MOVE]; // 200
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE]; // 550
const bigger_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 800
const bigger_creeper = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, 
                        CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                        MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] // 800

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)],
    [2, bigger_creep, utils.get_creep_cost(bigger_creep)],
    [3, bigger_creeper, utils.get_creep_cost(bigger_creeper)]
]

var roleBuilder = {
    
    get_harvest_count: function(room) {
        const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        var progress = 0;
        var totalProgress = 0;
        for (var construct_id in constructionSites) {
            progress += constructionSites[construct_id].progress;
            totalProgress += constructionSites[construct_id].progressTotal;
        }
        const v = (totalProgress-progress) / 100;
        if (v == 0) {
            return 0;
        }
        const val = Math.ceil(Math.log10(v));
        return val;
    },

    findConstructSite: function(creep) {
        return creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
            filter: (structure) => {
                return structure.room.name == creep.room.name;
            }
        });
    },

    run: function(creep) {
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            utils.cleanup_move_to(creep);
        }
        
        if (!creep.memory.building) {
            if (!utils.harvest_source(creep)) {
                creep.memory.building = true;
                utils.cleanup_move_to(creep);
            }
        }
        if (creep.memory.building) {
            if (creep.room.name != creep.memory.home_room) {
                creep.memory.destLoc = {roomName: creep.memory.home_room};
                utils.move_to(creep, this.findConstructSite);
                return;
            }
            if (creep.memory.destId == null) {
                const con = this.findConstructSite(creep);
                if (con != null) {
    	            creep.memory.destId = con.id;
                }
            }
            
            if (creep.memory.destId != null) {
                const source = Game.getObjectById(creep.memory.destId);
                if (source == null) {
                    //creep.memory.destId = null;
                    utils.cleanup_move_to(creep);
                } else {
                    const buildErr = creep.build(source);
                    if (buildErr == ERR_NOT_IN_RANGE) {
                        utils.move_to(creep, this.findConstructSite);
                    } else if (buildErr == ERR_INVALID_TARGET) {
                        utils.cleanup_move_to(creep);
                    }
                }
            } else {
                // not buildings attempt to recycle, as soon as a construction yard pops up this will no longer be called
                utils.recycle_creep(creep);
            }
	    }
	},
	
	create_creep: function(spawn, homeRoom=null) {
        homeRoom = homeRoom || spawn.room.name;
        var newName = 'Builder' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_builder][1], newName,
            {memory: {role: 'builder', building: false, home_room: homeRoom}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_builder === null || room.memory.upgrade_pos_builder === undefined) {
            room.memory.upgrade_pos_builder = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_builder][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_builder = build_creeps[build_creeps[room.memory.upgrade_pos_builder][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_builder][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_builder + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_builder = n[0];
            }
        }
    }
};

module.exports = roleBuilder;