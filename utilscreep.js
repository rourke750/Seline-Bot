let filtered_mapping = {};
let filtered_role_home_mapping = {};

let mapping_room_to_spawn = {};

let previous_creep_ids = {};

var utilscreep = {

    generateRoomToSpawnMapping: function() {
        mapping_room_to_spawn = {};
        for (const k in Game.spawns) {
            const spawn = Game.spawns[k];
            if (!(spawn.room.name in mapping_room_to_spawn)) {
                mapping_room_to_spawn[spawn.room.name] = [];
            }
            mapping_room_to_spawn[spawn.room.name].push(spawn);
        }
    },

    getRoomToSpawnMapping: function() {
        return mapping_room_to_spawn;
    },

    get_filtered_creeps: function(role) {
        if (!(role in filtered_mapping)) {
            // doesnt exist lets add it
            filtered_mapping[role] = _.filter(Game.creeps, (creep) => creep.memory.role == role);
        }
        return filtered_mapping[role];
    },

    get_role_home_filtered_creeps: function(home, role) {
        const hKey = [role, home];
        const v = filtered_role_home_mapping[hKey];
        if (!v) {
            return [];
        }
        return v;
    },

    add_creep: function(creep) {
        const r = creep.memory.role;
        const hKey = [r, creep.memory.home_room];
        if (!(r in filtered_mapping)) {
            filtered_mapping[r] = [];
        }
        filtered_mapping[r].push(creep);
        if (!filtered_role_home_mapping[hKey]) {
            filtered_role_home_mapping[hKey] = [];
        }
        filtered_role_home_mapping[hKey].push(creep);
    },
    
    clear_filtered_creeps: function() {
        filtered_mapping = {};
        filtered_role_home_mapping = {};
        for (const k in Game.creeps) {
            const v = Game.creeps[k];
            const r = v.memory.role;
            if (!(r in filtered_mapping)) {
                filtered_mapping[r] = [];
            }

            const hKey = [r, v.memory.home_room];
            if (!(hKey in filtered_role_home_mapping)) {
                filtered_role_home_mapping[hKey] = [];
            }
            filtered_mapping[r].push(v);
            filtered_role_home_mapping[hKey].push(v);
        }
    },

    setLastTicked: function(creepName, sourceId, roomName) {
        if (!(creepName in Memory.rooms[roomName].sources[sourceId].creeps))
        Memory.rooms[roomName].sources[sourceId].creeps[creepName] = {};
        Memory.rooms[roomName].sources[sourceId].creeps[creepName].lastTicked = Game.time;
    },

    getSourceCreepCount: function(sourceId, roomName) {
        return Object.keys(Memory.rooms[roomName].sources[sourceId].creeps).length;
    },

    find_closest_drop_off_structure: function(creep) {
        const containerPosX = creep.room.memory.spawnMasterX;
        const containerPosY = creep.room.memory.spawnMasterY;
        let objs = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                        filter: (structure) => {
                            const collectorStruct = structure.structureType == STRUCTURE_CONTAINER && structure.pos.x == containerPosX && 
                                structure.pos.y == containerPosY;
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN || 
                                collectorStruct || structure.structureType == STRUCTURE_TOWER) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && structure.room.name == creep.room.name;
                        }
                    });
        // we didn't find any spawns or extensions we could dump energy into
        if (!objs) {
            // Let's see if there is a storage or container we can use
            objs = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return ((structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) || 
                        (structure.structureType == STRUCTURE_STORAGE && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 500000)) 
                    && structure.room.name == creep.room.name;
                }
            });
        }
        // we didnt find and containers or storages, lets just go sit somewhere random
        if (!objs) {
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                        structure.room.name == creep.room.name;
                }
            });
            const i = Math.floor(Math.random() * targets.length);
            return targets[i];
        }
        return objs;
    },

    resetPreviousCreepIds: function() {
        previous_creep_ids = {};
        for (const k in Game.creeps) {
            previous_creep_ids[Game.creeps[k].id] = true; 
        }
    },

    containsPreviousCreepId: function(id) {
        return id in previous_creep_ids;
    },

    scaleByEnergy: function(array, singleAddons, roomEnergy) {
        const newArray = [];
        let totalEnergy = 0;
        let count = 0;
        // go through and add the single static requirements
        if (singleAddons) {
            for (const k in singleAddons) {
                const v = singleAddons[k];
                totalEnergy += BODYPART_COST[v];
                count++;
                newArray.push(v);
            }
        }
        if (totalEnergy > roomEnergy)
            return null;

        // now dynamically calculate the rest of the body parts
        // start by calculating how much it will cost to do each row
        let energyRow = 0;
        let countRow = array.length;
        for (const k in array) {
            const v = array[k];
            energyRow += BODYPART_COST[v];
        }

        // now energyRow has how much it costs per row to do
        while(count + countRow <= 50 && totalEnergy + energyRow < roomEnergy) {
            newArray.push(...array);
            count += countRow;
            totalEnergy += energyRow;
        }
        return newArray;
    }
};

module.exports = utilscreep;