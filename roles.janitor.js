const common = require('common');
const utils = require('utils');
const construction = require('construction');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];

const rampartAndWallMaxHealth = 3000;

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)]
];

const lastUpdated = {}; // mapping of room name to structures

const roleJanitor = {
    
    get_harvest_count: function(room) {
        var totalRepairPoints = 0
        const structs = room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART)
                            return structure.hits < rampartAndWallMaxHealth;
                        return structure.hits < structure.hitsMax && structure.room.name == room.name;
                    }
                });
        for (var struct in structs) {
            const s = structs[struct]
            //console.log(s.hitsMax + ' ' + s.hits + ' ' + s.structureType + ' ' + s.pos.x + ' ' + s.pos.y)
            if (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
                totalRepairPoints += Math.max(0, (rampartAndWallMaxHealth/10) - s.hits);
            else
                totalRepairPoints += s.hitsMax - s.hits;
        }
        let repairAmount = 0;
        if (totalRepairPoints > 0) {
            repairAmount = Math.ceil(Math.log10(totalRepairPoints/100));
        }

        // now get construction points
        const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        var progress = 0;
        var totalProgress = 0;
        for (var construct_id in constructionSites) {
            progress += constructionSites[construct_id].progress;
            totalProgress += constructionSites[construct_id].progressTotal;
        }
        const v = (totalProgress-progress) / 100;
        let buildAmount = 0;
        if (v > 0) 
            buildAmount = Math.ceil(Math.log10(v));
        return Math.max(0, Math.min(common.maxJanitors, repairAmount + buildAmount));
    },

    findConstructSite: function(creep) {
        const cons = creep.room.find(FIND_CONSTRUCTION_SITES, {
            filter: (structure) => {
                return structure.room.name == creep.room.name;
            }
        });
        if (cons.length == 0)
            return null;
        // handle prioritizing building the spawn
        cons.sort(function(a, b) {
            if (a.structureType == b.structureType)
                return 0;
            else if (a.structureType == STRUCTURE_SPAWN)
                return -1;
            else if (b.structureType == STRUCTURE_SPAWN)
                return 1;
            return 0;
          });
          return cons[0];
    },

    find_repairs: function(creep) {
        // add it to heap if its not there
        if (!(creep.memory.home_room in lastUpdated)) {
            lastUpdated[creep.memory.home_room] = {time: 0, structs: []};
        }

        if (lastUpdated[creep.memory.home_room].time + 50 < Game.time) {
            // time to reinitialize structs
            const struts = creep.room.find(FIND_STRUCTURES, {
                filter: function(struct) {
                    return struct.structureType != STRUCTURE_ROAD;
                }
            });

            // get roads
            const objs = construction.getRoadMappings(creep.memory.home_room);
            
            // merge structures into obj array
            for (const k in struts) {
                const v = struts[k];
                objs.push(v.id);
            }

            lastUpdated[creep.memory.home_room].structs = objs;
            lastUpdated[creep.memory.home_room].time = Game.time;
        }

        let closestObj = null;
        let closestRange = 9999999;
        for (const k in lastUpdated[creep.memory.home_room].structs) {
            const id = lastUpdated[creep.memory.home_room].structs[k];
            const v = Game.getObjectById(id);
            if (v == null) {
                //skip
                continue;
            }

            // check the structure if it needs repairs
            let needsRepairs = false;
            if (v.structureType == STRUCTURE_WALL || v.structureType == STRUCTURE_RAMPART) {
                needsRepairs = v.hits < 3000;
            } else {
                needsRepairs = v.hits < v.hitsMax;
            }

            if (!needsRepairs) {
                // doesn't need repairs next structure
                continue;
            }

            // it does need repairs is it close
            const range = v.pos.getRangeTo(creep);
            if (range < closestRange) {
                closestObj = v;
                closestRange = range; 
            }
        }

        return closestObj;
    },

    findCombined: function(creep) {
        // look for construction sites first
        const con = roleJanitor.findConstructSite(creep);
        // if none exist return repairs
        if (!con)
            return roleJanitor.find_repairs(creep);
        // otherwise randomly pick one or the other
        const i = Math.floor(Math.random() * 2);
        if (creep.room.name == 'W7N4')
            console.log(i, con)
        if (i == 1 && con) {
            // if equal to 1 return con if they exist
            return con;
        } 
        // lets try send a repair
        const repair = roleJanitor.find_repairs(creep);
        // if a repair exists return repair
        if (repair)
            return repair;
        // if we got here that means there wasnt a repair, just return either a construction or null
        return con;
    },

    run: function(creep) {
        // check if we are collecting but should start building
        if (creep.memory.collecting && creep.store.getFreeCapacity(RESOURCE_ENERGY) == 0) {
            creep.memory.collecting = false;
            utils.cleanup_move_to(creep);
        } else if (!creep.memory.collecting && creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            // used all our energy time to collect
            creep.memory.collecting = true;
            utils.cleanup_move_to(creep);
        }
        
        // harvest source now
        if (creep.memory.collecting) {
            if (!utils.harvest_source(creep)) {
                // if we are full then switch away from collecting
                creep.memory.collecting = false;
                utils.cleanup_move_to(creep);
            }
        }

        if (!creep.memory.collecting) {
            if (creep.room.name != creep.memory.home_room) {
                creep.memory.destLoc = {roomName: creep.memory.home_room};
                utils.move_to(creep, this.findCombined);
                return;
            }
            if (creep.memory.destId == null) {
                const repairs = this.findCombined(creep);
                if (repairs != null) {
                    creep.memory.destId = repairs.id;
                } else {
                    // todo meh just suicide
                    //creep.suicide();
                }
            }
            
            if (creep.memory.destId != null) {
                const source = Game.getObjectById(creep.memory.destId);
                if (source != null && (source instanceof StructureWall || source instanceof StructureRampart) && source.hits > 3000) {
                    utils.cleanup_move_to(creep);
                }

                if (source == null) {
                    utils.cleanup_move_to(creep);
                }
                else {
                    let err = null;
                    const con = source instanceof ConstructionSite;
                    // check if source type constructionsite
                    if (con)
                        err = creep.build(source);
                    else 
                        err = creep.repair(source);
                    if (err == ERR_NOT_IN_RANGE) {
                        utils.move_to(creep, this.findCombined);
                    } else if (err == ERR_INVALID_TARGET) {
                        utils.cleanup_move_to(creep);
                    }
                    
                    if (!con && source.hits == source.hitsMax) {
                        utils.cleanup_move_to(creep);
                    } else if (con && source.progress == source.progressTotal) {
                        utils.cleanup_move_to(creep);
                    }
                }
            } 
	    }
	},
	
	create_creep: function(spawn) {
        var newName = 'Janitor' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_janitor][1], newName,
            {memory: {role: common.creepRole.JANITOR, collecting: true, home_room: spawn.room.name}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_janitor == null || room.memory.upgrade_pos_janitor == undefined) {
            room.memory.upgrade_pos_janitor = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        if (energy_available == 0 && build_creeps[room.memory.upgrade_pos_janitor][0] == 0)
            return;
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_janitor][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_janitor = build_creeps[build_creeps[room.memory.upgrade_pos_janitor][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_janitor][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_janitor + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_janitor = n[0];
            }
        }
    },

    cleanUp(id) {
        
    }
};

module.exports = roleJanitor;